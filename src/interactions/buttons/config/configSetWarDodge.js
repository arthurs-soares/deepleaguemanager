const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens a ChannelSelect to choose the war dodge notifications channel
 * CustomId: config:channels:setWarDodge
 */
async function handle(interaction) {
  try {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId('config:channels:selectWarDodge')
      .setPlaceholder('Select a text channel for War Dodge notifications')
      .setChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ components: [row], ephemeral: true });
  } catch (error) {
    LoggerService.error('Error opening war dodge channel selector:', { error: error?.message });
    const msg = { content: '❌ Could not open the channel selector.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

