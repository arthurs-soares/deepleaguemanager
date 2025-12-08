const { MessageFlags } = require('discord.js');
const { isModeratorOrHoster } = require('../core/permissions');
const WagerTicket = require('../../models/wager/WagerTicket');
const WagerService = require('../../services/WagerService');
const { buildWagerCloseButtonRow } = require('../tickets/closeButtons');
const { getOrCreateUserProfile } = require('../user/userProfile');
const { auditAdminAction } = require('../misc/adminAudit');

async function record(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const allowed = await isModeratorOrHoster(member, interaction.guild.id);
  if (!allowed) return interaction.editReply({ content: '❌ Permission denied.' });

  const winnerUser = interaction.options.getUser('winner', true);
  const loserUser = interaction.options.getUser('loser', true);

  // Expose interaction for downstream logging enrichment
  global._currentInteraction = interaction;

  const embed = await WagerService.recordWager(
    interaction.guild,
    interaction.user.id,
    winnerUser.id,
    loserUser.id,
    interaction.client
  );

  // Send publicly
  await interaction.editReply({ content: 'Wager recorded successfully.' });
  await interaction.followUp({
    components: [embed],
    flags: MessageFlags.IsComponentsV2
  });

  try {
    const ticket = await WagerTicket.findOne({
      discordGuildId: interaction.guild.id,
      channelId: interaction.channel.id
    });
    if (ticket) {
      await interaction.followUp({
        content: '✅ Result recorded. Use the button below to close.',
        components: [buildWagerCloseButtonRow(ticket._id)],
        ephemeral: false
      });
    }
  } catch (_) { }
}

/**
 * Set wager stats for a user (wins, losses, games played auto-calculated)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function setStats(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser('user', true);
  const wins = interaction.options.getInteger('wins') ?? null;
  const losses = interaction.options.getInteger('losses') ?? null;

  if (wins === null && losses === null) {
    return interaction.editReply({
      content: '❌ You must provide at least wins or losses.'
    });
  }

  if (wins !== null && wins < 0) {
    return interaction.editReply({ content: '❌ Wins cannot be negative.' });
  }

  if (losses !== null && losses < 0) {
    return interaction.editReply({ content: '❌ Losses cannot be negative.' });
  }

  const profile = await getOrCreateUserProfile(targetUser.id);
  const oldWins = profile.wagerWins || 0;
  const oldLosses = profile.wagerLosses || 0;
  const oldGames = profile.wagerGamesPlayed || 0;

  // Update wins if provided
  if (wins !== null) {
    profile.wagerWins = wins;
  }

  // Update losses if provided
  if (losses !== null) {
    profile.wagerLosses = losses;
  }

  // Auto-calculate games played = wins + losses
  const newWins = profile.wagerWins || 0;
  const newLosses = profile.wagerLosses || 0;
  profile.wagerGamesPlayed = newWins + newLosses;

  await profile.save();

  // Audit log
  try {
    await auditAdminAction(
      interaction.guild,
      interaction.user.id,
      'Set Wager Stats',
      {
        targetUserId: targetUser.id,
        extra: `W: ${oldWins}→${newWins}, L: ${oldLosses}→${newLosses}, G: ${oldGames}→${profile.wagerGamesPlayed}`
      }
    );
  } catch (_) { }

  return interaction.editReply({
    content: `✅ Updated **${targetUser.tag}**'s wager stats:\n` +
      `• Wins: **${oldWins}** → **${newWins}**\n` +
      `• Losses: **${oldLosses}** → **${newLosses}**\n` +
      `• Games Played: **${oldGames}** → **${profile.wagerGamesPlayed}**`
  });
}

module.exports = { record, setStats };

