const { MessageFlags } = require('discord.js');
const TicketService = require('../../../services/TicketService');
const { buildTicketCloseConfirmation } = require('../../../utils/embeds/ticketEmbeds');
const { isModeratorOrHoster } = require('../../../utils/core/permissions');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const LoggerService = require('../../../services/LoggerService');

/**
 * Show confirmation dialog before closing a ticket
 * CustomId: ticket:close:<ticketId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply();

    const [, , ticketId] = interaction.customId.split(':');
    if (!ticketId) {
      return interaction.editReply({ content: '❌ Invalid ticket ID.' });
    }

    // Use Service to get ticket
    const ticket = await TicketService.getTicket(ticketId);
    if (!ticket) {
      return interaction.editReply({ content: '❌ Ticket not found.' });
    }

    if (ticket.status === 'closed') {
      return interaction.editReply({ content: '❌ This ticket is already closed.' });
    }

    // Permission Check (Validation specific to this interaction context)
    const roleConfig = await getOrCreateRoleConfig(interaction.guild.id);
    const isModerator = await isModeratorOrHoster(interaction.member, interaction.guild.id);
    const isAdminSupport = roleConfig.adminSupportRoleIds?.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    );
    const isSupport = roleConfig.supportRoleIds?.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    );
    const isTicketOwner = ticket.userId === interaction.user.id;

    // For admin tickets, only admin support and ticket owner can close
    // For other tickets, support and moderators can also close
    const canClose = isTicketOwner || isAdminSupport ||
      (ticket.ticketType !== 'admin' && (isModerator || isSupport));

    if (!canClose) {
      return interaction.editReply({
        content: '❌ You do not have permission to close this ticket.'
      });
    }

    // Get ticket creator
    const creator = await interaction.client.users.fetch(ticket.userId).catch(() => null);
    const creatorTag = creator ? creator.tag : `Unknown User (${ticket.userId})`;

    // Format ticket type for display
    const ticketTypeDisplay = {
      admin: 'Admin Ticket',
      blacklist_appeal: 'Blacklist Appeal',
      general: 'General Ticket',
      roster: 'Roster Ticket'
    }[ticket.ticketType] || ticket.ticketType;

    // Build confirmation container using helper
    const payload = buildTicketCloseConfirmation(ticket, creatorTag, ticketTypeDisplay, interaction.channel);

    await interaction.editReply({
      content: '', // Clear any loading message
      ...payload
    });

  } catch (error) {
    LoggerService.error('Error showing ticket close confirmation:', { error: error?.message });
    const msg = { content: '❌ Could not show confirmation dialog.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
