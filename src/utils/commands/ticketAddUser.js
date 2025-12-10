/**
 * Ticket add-user handler
 * Extracted from ticketHandlers.js to comply with max-lines rule
 */
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds/embedBuilder');
const { isModeratorOrHoster } = require('../../utils/core/permissions');
const War = require('../../models/war/War');
const WagerTicket = require('../../models/wager/WagerTicket');
const Guild = require('../../models/guild/Guild');
const { sendLog } = require('../../utils/core/logger');

/**
 * Check if a user is a leader/manager of a guild
 * @param {Object} guild - Guild document
 * @param {string} userId - Discord User ID
 * @returns {boolean}
 */
function isGuildLeader(guild, userId) {
  if (!guild) return false;

  // Registered by or Manager
  if (guild.registeredBy === userId) return true;
  if (guild.managers && guild.managers.includes(userId)) return true;

  // Leader role in members
  if (guild.members) {
    const member = guild.members.find(m => m.userId === userId);
    if (member) {
      const leaderRoles = ['lider', 'leader', 'vice-lider', 'co-leader'];
      if (leaderRoles.includes(member.role)) return true;
    }
  }
  return false;
}

/**
 * Check if a user is in a guild's roster/members
 * @param {Object} guild - Guild document
 * @param {string} userId - Discord User ID
 * @returns {boolean}
 */
function isGuildMember(guild, userId) {
  if (!guild) return false;

  // Check global members list
  if (guild.members && guild.members.some(m => m.userId === userId)) return true;

  // Check legacy global rosters
  if (guild.mainRoster && guild.mainRoster.includes(userId)) return true;
  if (guild.subRoster && guild.subRoster.includes(userId)) return true;

  // Check region-specific rosters
  if (guild.regions && Array.isArray(guild.regions)) {
    for (const region of guild.regions) {
      if (region.mainRoster && region.mainRoster.includes(userId)) return true;
      if (region.subRoster && region.subRoster.includes(userId)) return true;
    }
  }

  return false;
}

/**
 * Handle /ticket add-user
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleAddUser(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.options.getUser('user', true);
  const channel = interaction.channel;

  // Fetch ticket information first
  const [war, wager] = await Promise.all([
    War.findOne({
      discordGuildId: interaction.guild.id,
      channelId: channel.id
    }),
    WagerTicket.findOne({
      discordGuildId: interaction.guild.id,
      channelId: channel.id
    })
  ]);

  if (!war && !wager) {
    const container = createErrorEmbed(
      'Not a ticket',
      'This command must be used within a ticket channel.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // Check generally strictly permissions first (Moderator/Hoster)
  let authorized = await isModeratorOrHoster(
    interaction.member,
    interaction.guild.id
  );

  // If not a moderator/hoster, can they add a user if it's a WAR ticket?
  if (!authorized && war) {
    try {
      const [guildA, guildB] = await Promise.all([
        Guild.findById(war.guildAId),
        Guild.findById(war.guildBId)
      ]);

      const userId = interaction.user.id;
      const targetId = target.id;

      // Check if user is Leader of Guild A AND target is Member of Guild A
      if (isGuildLeader(guildA, userId) && isGuildMember(guildA, targetId)) {
        authorized = true;
      }
      // Check for Guild B
      else if (isGuildLeader(guildB, userId) && isGuildMember(guildB, targetId)) {
        authorized = true;
      }
    } catch (err) {
      // If fetching guilds fails, authorized remains false
    }
  }

  if (!authorized) {
    const container = createErrorEmbed(
      'Permission denied',
      'You do not have permission to use this command.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  const canView = channel.permissionsFor(target.id)?.has(
    PermissionFlagsBits.ViewChannel
  );

  if (canView) {
    const container = createErrorEmbed(
      'Already has access',
      `User <@${target.id}> already has access to this ticket.`
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  try {
    await channel.permissionOverwrites.edit(
      target.id,
      {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
      },
      { reason: 'Added to ticket via /ticket add-user' }
    );
  } catch (_e) {
    const container = createErrorEmbed(
      'Failed to add',
      'Could not update channel permissions. Check bot permissions.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  const container = createSuccessEmbed(
    'User added',
    `User <@${target.id}> has been added to this ticket.`
  );
  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  const ticketLabel = war ? `War ${war._id}` : `Wager Ticket ${wager._id}`;
  try {
    await sendLog(
      interaction.guild,
      '👤 User added to ticket',
      `${ticketLabel} — Added: <@${target.id}> by <@${interaction.user.id}>`
    );
  } catch (_) { }
}

module.exports = { handleAddUser };
