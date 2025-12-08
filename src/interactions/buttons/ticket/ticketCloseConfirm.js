const { MessageFlags } = require('discord.js');
const { isModeratorOrHoster } = require('../../../utils/core/permissions');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { sendTranscriptToLogs } = require('../../../utils/tickets/transcript');
const GeneralTicket = require('../../../models/ticket/GeneralTicket');
const LoggerService = require('../../../services/LoggerService');

/**
 * Confirm and execute ticket closure
 * CustomId: ticket:close:confirm:<ticketId>
 */
async function handle(interaction) {
  try {
    await interaction.deferUpdate();

    const [, , , ticketId] = interaction.customId.split(':');
    if (!ticketId) {
      return interaction.followUp({
        content: '❌ Invalid ticket ID.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Find the ticket
    const ticket = await GeneralTicket.findById(ticketId);
    if (!ticket) {
      return interaction.followUp({
        content: '❌ Ticket not found.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (ticket.status === 'closed') {
      return interaction.followUp({
        content: '❌ This ticket is already closed.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check permissions again (security)
    const roleConfig = await getOrCreateRoleConfig(interaction.guild.id);
    const isModerator = await isModeratorOrHoster(interaction.member, interaction.guild.id);
    const isAdminSupport = roleConfig.adminSupportRoleIds?.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    );
    const isSupport = roleConfig.supportRoleIds?.some(roleId =>
      interaction.member.roles.cache.has(roleId)
    );
    const isTicketOwner = ticket.userId === interaction.user.id;

    const canClose = isTicketOwner || isAdminSupport ||
      (ticket.ticketType !== 'admin' && (isModerator || isSupport));

    if (!canClose) {
      return interaction.followUp({
        content: '❌ You do not have permission to close this ticket.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Update ticket status
    ticket.status = 'closed';
    ticket.closedByUserId = interaction.user.id;
    ticket.closedAt = new Date();
    await ticket.save();

    // Send transcript to logs with enhanced metadata
    const channel = interaction.channel;
    if (channel) {
      try {
        await sendTranscriptToLogs(
          interaction.guild,
          channel,
          `General ticket (${ticket.ticketType}) closed by ${interaction.user.tag}`,
          ticket
        );
      } catch (err) {
        LoggerService.warn('Failed to send transcript:', { error: err?.message });
      }
    }

    await interaction.followUp({
      content: '✅ Ticket closed. This channel will be deleted in 10 seconds.',
      flags: MessageFlags.Ephemeral
    });

    // Delete channel after delay
    setTimeout(async () => {
      try {
        if (channel) await channel.delete('Ticket closed');
      } catch (err) {
        LoggerService.warn('Failed to delete ticket channel:', { error: err?.message });
      }
    }, 10000);

  } catch (error) {
    LoggerService.error('Error confirming ticket closure:', { error: error?.message });
    const msg = {
      content: '❌ Could not close the ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

