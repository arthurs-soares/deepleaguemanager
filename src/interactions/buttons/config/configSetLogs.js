const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens a ChannelSelect to choose the logs channel
 * CustomId: config:channels:setLogs
 */
async function handle(interaction) {
  try {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId('config:channels:selectLogs')
      .setPlaceholder('Select a text channel for logs')
      .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(menu);
    const { MessageFlags } = require('discord.js');
    return interaction.reply({ components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error opening logs channel selector:', { error: error?.message });
    const { MessageFlags } = require('discord.js');
    const msg = { content: '❌ Could not open the channel selector.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

