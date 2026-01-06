const { ChannelType, MessageFlags } = require('discord.js');
const {
  getOrCreateServerSettings
} = require('../../utils/system/serverSettings');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive CATEGORY selection for wager channels (slot 2), save
 * CustomId: config:channels:selectWagerCategory2
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) {
      return interaction.editReply({ content: 'Action cancelled.' });
    }

    const category = interaction.guild.channels.cache.get(channelId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: '❌ Select a valid category.' });
    }

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.wagerCategoryId2 = channelId;
    await cfg.save();

    return interaction.editReply({
      content: `✅ Wager category 2 set to <#${channelId}>.`
    });
  } catch (error) {
    LoggerService.error('Error saving wager category 2:', error);
    const msg = {
      content: '❌ Could not save the wager category.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
