const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { isModeratorOrHoster } = require('../../../utils/core/permissions');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const GeneralTicket = require('../../../models/ticket/GeneralTicket');
const { colors, emojis } = require('../../../config/botConfig');
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

    // Find the ticket
    const ticket = await GeneralTicket.findById(ticketId);
    if (!ticket) {
      return interaction.editReply({ content: '❌ Ticket not found.' });
    }

    if (ticket.status === 'closed') {
      return interaction.editReply({ content: '❌ This ticket is already closed.' });
    }

    // Check permissions: ticket owner, moderators, support, or admin support
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

    // Build confirmation container
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning} Confirm Ticket Closure`);

    const descText = new TextDisplayBuilder()
      .setContent('Are you sure you want to close this ticket? This action cannot be undone.');

    const detailsText = new TextDisplayBuilder()
      .setContent(
        `**Ticket Type:** ${ticketTypeDisplay}\n` +
        `**Creator:** ${creatorTag}\n` +
        `**Created:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>\n` +
        `**Channel:** ${interaction.channel}`
      );

    container.addTextDisplayComponents(titleText, descText, detailsText);

    // Create confirmation buttons
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:confirm:${ticketId}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Close'),
      new ButtonBuilder()
        .setCustomId(`ticket:close:cancel:${ticketId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    await interaction.editReply({
      content: '',
      components: [container, actionRow],
      flags: MessageFlags.IsComponentsV2
    });

  } catch (error) {
    LoggerService.error('Error showing ticket close confirmation:', { error: error?.message });
    const msg = { content: '❌ Could not show confirmation dialog.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

