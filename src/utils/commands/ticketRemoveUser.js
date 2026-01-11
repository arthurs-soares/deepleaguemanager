/**
 * Ticket remove-user handler
 * Allows removing users from ticket channels
 */
const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const { createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds/embedBuilder');
const { isModeratorOrHoster } = require('../../utils/core/permissions');
const War = require('../../models/war/War');
const WagerTicket = require('../../models/wager/WagerTicket');
const GeneralTicket = require('../../models/ticket/GeneralTicket');
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
 * Handle /ticket remove-user
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleRemoveUser(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.options.getUser('user', true);
  const channel = interaction.channel;

  // Cannot remove yourself
  if (target.id === interaction.user.id) {
    const container = createErrorEmbed(
      'Invalid action',
      'You cannot remove yourself from a ticket.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // Fetch ticket information
  const [war, wager, generalTicket] = await Promise.all([
    War.findOne({
      discordGuildId: interaction.guild.id,
      channelId: channel.id
    }),
    WagerTicket.findOne({
      discordGuildId: interaction.guild.id,
      channelId: channel.id
    }),
    GeneralTicket.findOne({
      discordGuildId: interaction.guild.id,
      channelId: channel.id
    })
  ]);

  if (!war && !wager && !generalTicket) {
    const container = createErrorEmbed(
      'Not a ticket',
      'This command must be used within a ticket channel.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // Check permissions - Moderator/Hoster can always remove
  let authorized = await isModeratorOrHoster(
    interaction.member,
    interaction.guild.id
  );

  // If not mod/hoster, check if guild leader for war tickets
  if (!authorized && war) {
    try {
      const [guildA, guildB] = await Promise.all([
        Guild.findById(war.guildAId),
        Guild.findById(war.guildBId)
      ]);

      const userId = interaction.user.id;

      // Guild leaders can remove users
      if (isGuildLeader(guildA, userId) || isGuildLeader(guildB, userId)) {
        authorized = true;
      }
    } catch (_err) {
      // If fetching guilds fails, authorized remains false
    }
  }

  // For wager tickets, check if user is one of the participants
  if (!authorized && wager) {
    const userId = interaction.user.id;
    // Check if user is  one of the participants (team leads)
    const isParticipant = wager.participants &&
            wager.participants.some(p => p.leader === userId);
    if (isParticipant) {
      authorized = true;
    }
  }

  if (!authorized) {
    const container = createErrorEmbed(
      'Permission denied',
      'You do not have permission to remove users from this ticket.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // Check if target has access to the channel
  const canView = channel.permissionsFor(target.id)?.has(
    PermissionFlagsBits.ViewChannel
  );

  if (!canView) {
    const container = createErrorEmbed(
      'User not in ticket',
      `User <@${target.id}> does not have access to this ticket.`
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  // Check if trying to remove the ticket owner
  const isTicketOwner = (war && (war.createdBy === target.id)) ||
        (wager && wager.createdBy === target.id) ||
        (generalTicket && generalTicket.userId === target.id);

  if (isTicketOwner) {
    const container = createErrorEmbed(
      'Cannot remove owner',
      'You cannot remove the ticket owner. Close the ticket instead.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  try {
    // Remove permissions from the user
    await channel.permissionOverwrites.delete(
      target.id,
      'Removed from ticket via /ticket remove-user'
    );
  } catch (_e) {
    const container = createErrorEmbed(
      'Failed to remove',
      'Could not update channel permissions. Check bot permissions.'
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  const container = createSuccessEmbed(
    'User removed',
    `User <@${target.id}> has been removed from this ticket.`
  );
  await interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  // Log the action
  const ticketLabel = war
    ? `War ${war._id}`
    : wager
      ? `Wager Ticket ${wager._id}`
      : `General Ticket (${generalTicket.ticketType})`;
  try {
    await sendLog(
      interaction.guild,
      '👤 User removed from ticket',
      `${ticketLabel} — Removed: <@${target.id}> by <@${interaction.user.id}>`
    );
  } catch (_) { }
}

module.exports = { handleRemoveUser };
