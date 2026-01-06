const { ChannelType, MessageFlags } = require('discord.js');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive CATEGORY selection for NA West war channels, save
 * CustomId: config:channels:selectWarCategoryNAW
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const category = interaction.guild.channels.cache.get(channelId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: '❌ Select a valid category.' });
    }

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.warCategoryNAWId = channelId;
    await cfg.save();

    return interaction.editReply({ content: `✅ NA West War category set to <#${channelId}>.` });
  } catch (error) {
    LoggerService.error('Error saving NA West war category:', { error: error?.message });
    const msg = {
      content: '❌ Could not save the NA West war category.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
