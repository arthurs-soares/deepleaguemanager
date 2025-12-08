const { MessageFlags } = require('discord.js');
const TicketService = require('../../../services/TicketService');
const { hasRegistrationAccess } = require('../../../utils/core/permissions');
const LoggerService = require('../../../services/LoggerService');
const { emojis, colors } = require('../../../config/botConfig');

/**
 * Ticket type configurations
 */
const TICKET_TYPES = {
  admin: {
    emoji: emojis.warning || '⚠️',
    title: 'Admin Ticket',
    description: 'This ticket is for reporting chasebannable rule violations. Please provide detailed information about the incident.',
    color: colors.error
  },
  blacklist_appeal: {
    emoji: emojis.blacklistAppeal,
    title: 'Blacklist Appeal',
    description: 'This ticket is for appealing a blacklist. Please explain your situation and why you believe the blacklist should be reconsidered.',
    color: colors.primary
  },
  general: {
    emoji: emojis.generalChat,
    title: 'General Ticket',
    description: 'This ticket is for general inquiries and server-related questions. Our support team will assist you shortly.',
    color: colors.general
  },
  roster: {
    emoji: emojis.rosters || '📋',
    title: 'Roster Ticket',
    description: 'This ticket is for roster registration and editing. Please provide the details of your roster request.',
    color: colors.success
  }
};

/**
 * Handle ticket opening for all ticket types
 * CustomId: ticket:open:<ticketType>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , ticketType] = interaction.customId.split(':');
    if (!ticketType || !TICKET_TYPES[ticketType]) {
      return interaction.editReply({ content: '❌ Invalid ticket type.' });
    }

    // Check registration access for roster tickets (Validation)
    if (ticketType === 'roster') {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const canAccess = await hasRegistrationAccess(member, interaction.guild.id);
      if (!canAccess) {
        return interaction.editReply({
          content: '❌ You do not have permission to create roster tickets. Please contact an administrator if you believe this is an error.'
        });
      }
    }

    // Delegate to Service
    const result = await TicketService.openTicket(
      interaction.guild,
      interaction.user,
      ticketType,
      TICKET_TYPES[ticketType]
    );

    if (!result.success) {
      if (result.code === 'TICKET_EXISTS') {
        return interaction.editReply({
          content: `❌ You already have an open ${TICKET_TYPES[ticketType].title.toLowerCase()}: <#${result.channelId}>`
        });
      } else {
        throw new Error(result.code || 'UNKNOWN_ERROR');
      }
    }

    return interaction.editReply({
      content: `✅ ${TICKET_TYPES[ticketType].title} created: <#${result.channelId}>`
    });

  } catch (error) {
    LoggerService.error('Error opening ticket:', { error: error?.message });

    // Friendly error messages for known service errors
    let message = '❌ Could not create the ticket.';
    if (error.message === 'CATEGORY_NOT_CONFIGURED' || error.message === 'CATEGORY_NOT_FOUND') {
      message = '❌ General tickets category is not properly configured. Please contact an administrator.';
    }

    const msg = { content: message, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.editReply(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
