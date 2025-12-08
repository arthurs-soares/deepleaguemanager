const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType, MessageFlags } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens a ChannelSelect to choose the roster forum (forum channels only)
 * CustomId: config:channels:setRosterForum
 */
async function handle(interaction) {
  try {
    const menu = new ChannelSelectMenuBuilder()
      .setCustomId('config:channels:selectRosterForum')
      .setPlaceholder('Select a FORUM channel for guild rosters')
      .setChannelTypes(ChannelType.GuildForum);

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error opening roster forum selector:', { error: error?.message });
    const msg = { content: '❌ Could not open the forum selector.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

