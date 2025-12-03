const { MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const { buildHelpSelectRow } = require('../../utils/misc/helpMenuBuilder');
const {
  buildCommandsEmbed,
  buildLogsEmbed,
  buildLeaderboardEmbed,
  buildProfileEmbed,
  buildAdminPanelEmbed,
  buildWarSystemEmbed,
  buildSecurityEmbed,
  buildWhatsNewEmbed,
} = require('../../utils/embeds/helpEmbeds/index.js');
const { buildWagerSystemEmbed } = require('../../utils/embeds/helpEmbeds/wagerSystem');
const LoggerService = require('../../services/LoggerService');

/**
 * StringSelectMenu handler for /help
 * CustomId: help:categories
 * Values: whats_new | commands | logs | leaderboard | profile | admin_panel |
 *         war_system | wager_system | security
 * @param {StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
  try {
    const value = interaction.values?.[0];
    if (!value) return interaction.deferUpdate();

    const container = buildContainerForValue(value, interaction.client);

    // Keep the dropdown for navigation
    const row = buildHelpSelectRow();
    return interaction.update({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in select help:categories:', error);
    const container = new ContainerBuilder();

    const errorColor = typeof colors.error === 'string'
      ? parseInt(colors.error.replace('#', ''), 16)
      : (colors.error || 0xff4d4f);
    container.setAccentColor(errorColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# Error');
    const descText = new TextDisplayBuilder()
      .setContent('Could not update the help. Please try again.');

    container.addTextDisplayComponents(titleText, descText);

    const msg = {
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

/**
 * Build the container for a specific help category
 * @param {string} value - The selected category value
 * @param {Client} client - Discord client instance
 * @returns {ContainerBuilder}
 */
function buildContainerForValue(value, client) {
  switch (value) {
    case 'whats_new':
      return buildWhatsNewEmbed();
    case 'commands':
      return buildCommandsEmbed(client);
    case 'logs':
      return buildLogsEmbed();
    case 'leaderboard':
      return buildLeaderboardEmbed();
    case 'profile':
      return buildProfileEmbed();
    case 'admin_panel':
      return buildAdminPanelEmbed();
    case 'war_system':
      return buildWarSystemEmbed();
    case 'security':
      return buildSecurityEmbed();
    case 'wager_system':
      return buildWagerSystemEmbed();
    default: {
      const container = new ContainerBuilder();
      const primaryColor = typeof colors.primary === 'string'
        ? parseInt(colors.primary.replace('#', ''), 16)
        : colors.primary;
      container.setAccentColor(primaryColor);

      const titleText = new TextDisplayBuilder()
        .setContent(`# ${client.user.username} — Help`);
      const descText = new TextDisplayBuilder()
        .setContent(`${emojis.info} Use the menu to navigate through categories.`);

      container.addTextDisplayComponents(titleText, descText);
      return container;
    }
  }
}

module.exports = { handle };

