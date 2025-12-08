const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { buildChannelConfigOptions, buildChannelsDisplayText } = require('../../../utils/config/channelConfigOptions');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens Channels panel
 * CustomId: config:channels
 */
async function handle(interaction) {
  try {
    const cfg = await getOrCreateServerSettings(interaction.guild.id);

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# ⚙️ Configure Channels');

    const descText = new TextDisplayBuilder()
      .setContent('Select a channel type from the dropdown menu below to configure it.');

    const channelsText = new TextDisplayBuilder()
      .setContent(buildChannelsDisplayText(cfg));

    container.addTextDisplayComponents(titleText, descText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(channelsText);

    const channelSelect = new StringSelectMenuBuilder()
      .setCustomId('config:channels:select')
      .setPlaceholder('Select a channel type to configure')
      .addOptions(buildChannelConfigOptions());

    const row = new ActionRowBuilder().addComponents(channelSelect);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error opening channels panel:', { error: error?.message });
    const msg = { content: '❌ Could not open the channels panel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

