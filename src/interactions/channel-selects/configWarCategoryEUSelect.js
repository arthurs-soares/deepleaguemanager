const { ChannelType } = require('discord.js');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive CATEGORY selection for EU war channels, save
 * CustomId: config:channels:selectWarCategoryEU
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const category = interaction.guild.channels.cache.get(channelId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: '❌ Select a valid category.' });
    }

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.warCategoryEUId = channelId;
    await cfg.save();

    return interaction.editReply({ content: `✅ EU War category set to <#${channelId}>.` });
  } catch (error) {
    LoggerService.error('Error saving EU war category:', { error: error?.message });
    const msg = { content: '❌ Could not save the EU war category.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
