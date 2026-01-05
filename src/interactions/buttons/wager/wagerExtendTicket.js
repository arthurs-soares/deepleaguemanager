const { MessageFlags } = require('discord.js');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const LoggerService = require('../../../services/LoggerService');
const { isDatabaseConnected } = require('../../../config/database');

/**
 * Check if user has permission to extend the wager ticket
 * Allowed: Admins, Hosters, Moderators, and Ticket Participants
 * @param {import('discord.js').GuildMember} member
 * @param {string} guildId
 * @param {Object} ticket - WagerTicket document
 * @returns {Promise<boolean>}
 */
async function hasExtendPermission(member, guildId, ticket) {
  // 1. Administrators always have permission
  if (member.permissions.has('Administrator')) return true;

  // 2. Ticket Participants
  const userId = member.id;
  if (ticket.initiatorUserId === userId || ticket.opponentUserId === userId) return true;
  if (ticket.is2v2) {
    if (ticket.initiatorTeammateId === userId || ticket.opponentTeammateId === userId) return true;
  }

  // 3. Hosters or Moderators
  try {
    const rolesCfg = await getOrCreateRoleConfig(guildId);
    const hosterIds = rolesCfg?.hostersRoleIds || [];
    const modIds = rolesCfg?.moderatorsRoleIds || [];

    const allAllowedRoles = [...hosterIds, ...modIds];
    return member.roles.cache.some(r => allAllowedRoles.includes(r.id));
  } catch (_) {
    return false;
  }
}

/**
 * Extend a wager ticket time (resetting the 3-day timer)
 * CustomId: wager:extend:<ticketId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , ticketId] = interaction.customId.split(':');

    if (!ticketId) {
      return interaction.editReply({ content: '❌ Ticket ID not provided.' });
    }

    if (!isDatabaseConnected()) {
      return interaction.editReply({ content: '❌ Database is temporarily unavailable.' });
    }

    // Find the wager ticket
    const ticket = await WagerTicket.findById(ticketId);

    if (!ticket) {
      return interaction.editReply({ content: '❌ Wager ticket not found.' });
    }

    if (ticket.status !== 'open') {
      return interaction.editReply({ content: '❌ This wager ticket is no longer open.' });
    }

    // Check permissions
    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await hasExtendPermission(member, interaction.guild.id, ticket))) {
      return interaction.editReply({
        content: '❌ You do not have permission to extend this ticket.'
      });
    }

    // Extend the ticket
    ticket.inactivityReactivatedAt = new Date();
    ticket.lastInactivityWarningAt = null; // Reset warning so it won't trigger again immediately
    await ticket.save();

    // Update the message to show it was extended
    try {
      await interaction.message.edit({
        content: `✅ **Ticket Extended**\n\nThis wager ticket has been extended by <@${interaction.user.id}>.\n\nThe auto-dodge timer has been reset.`,
        components: [] // Remove the button
      });
    } catch (_) {
      LoggerService.warn('[Wager Extend] Could not edit original warning message');
    }

    // Send confirmation in the channel
    try {
      await interaction.channel.send({
        content: `🔄 <@${interaction.user.id}> extended this wager ticket. The auto-dodge timer has been reset.`
      });
    } catch (_) {
      // Ignore if we can't send
    }

    LoggerService.info(`[Wager Extend] Ticket ${ticketId} extended by ${interaction.user.id}`);

    return interaction.editReply({
      content: '✅ Ticket extended successfully! The auto-dodge timer has been reset.'
    });

  } catch (error) {
    LoggerService.error('Error in wager:extend button:', { error: error?.message });
    const msg = { content: '❌ Could not extend the ticket.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
