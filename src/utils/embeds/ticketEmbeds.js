const {
  ContainerBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { emojis, colors } = require('../../config/botConfig');

/**
 * Build the main ticket panel container
 * @param {Object} config - Ticket type config
 * @param {User} user - Discord user who opened the ticket
 * @param {string} ticketId - DB ID of the ticket
 */
function buildTicketPanel(config, user, ticketId) {
  const container = new ContainerBuilder();
  container.setAccentColor(config.color);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${config.emoji} ${config.title}`);

  const descText = new TextDisplayBuilder()
    .setContent(config.description);

  const userText = new TextDisplayBuilder()
    .setContent(`**Opened by:** ${user}`);

  const timestampText = new TextDisplayBuilder()
    .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

  container.addTextDisplayComponents(titleText, descText, userText, timestampText);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:${ticketId}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Close Ticket')
  );

  return { components: [container, actionRow], flags: MessageFlags.IsComponentsV2 };
}

/**
 * Build the ticket close confirmation panel
 * @param {Object} ticket - Ticket DB object
 * @param {string} creatorTag - Tag of the ticket creator
 * @param {string} ticketTypeDisplay - Human readable ticket type
 * @param {Channel} channel - Discord channel
 */
function buildTicketCloseConfirmation(ticket, creatorTag, ticketTypeDisplay, channel) {
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
            `**Created:** <t:${Math.floor(new Date(ticket.createdAt).getTime() / 1000)}:R>\n` +
            `**Channel:** ${channel}`
    );

  container.addTextDisplayComponents(titleText, descText, detailsText);

  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket:close:confirm:${ticket._id}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Confirm Close'),
    new ButtonBuilder()
      .setCustomId(`ticket:close:cancel:${ticket._id}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Cancel')
  );

  return { components: [container, actionRow], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
  buildTicketPanel,
  buildTicketCloseConfirmation
};
