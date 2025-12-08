const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens a ChannelSelect to choose the CATEGORY where wager channels will be created
 * CustomId: config:channels:setWagerCategory
 */
async function handle(interaction) {
  try {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId('config:channels:selectWagerCategory')
      .setPlaceholder('Select a CATEGORY for wager channels')
      .setChannelTypes(ChannelType.GuildCategory);

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ components: [row], ephemeral: true });
  } catch (error) {
    LoggerService.error('Error opening wager category selector:', { error: error?.message });
    const msg = { content: '❌ Could not open the channel selector.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

