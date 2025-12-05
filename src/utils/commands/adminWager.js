const { MessageFlags } = require('discord.js');
const { isModeratorOrHoster } = require('../core/permissions');
const WagerTicket = require('../../models/wager/WagerTicket');
const { recordWager } = require('../wager/wagerService');
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

  const embed = await recordWager(
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
  } catch (_) {}
}

/**
 * Set wager wins for a user
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function setWins(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetUser = interaction.options.getUser('user', true);
  const wins = interaction.options.getInteger('wins', true);

  if (wins < 0) {
    return interaction.editReply({ content: '❌ Wins cannot be negative.' });
  }

  const profile = await getOrCreateUserProfile(targetUser.id);
  const oldWins = profile.wagerWins || 0;

  profile.wagerWins = wins;
  await profile.save();

  // Audit log
  try {
    await auditAdminAction(interaction.guild, interaction.user.id, 'Set Wager Wins', {
      targetUserId: targetUser.id,
      extra: `Changed from ${oldWins} to ${wins}`
    });
  } catch (_) {}

  return interaction.editReply({
    content: `✅ Set **${targetUser.tag}**'s wager wins to **${wins}** (was ${oldWins}).`
  });
}

module.exports = { record, setWins };

