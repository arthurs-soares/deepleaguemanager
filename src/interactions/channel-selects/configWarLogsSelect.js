const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Save War Logs Channel selection
 * CustomId: config:channels:selectWarLogs
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) {
      return interaction.editReply({ content: 'Action cancelled.' });
    }

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.warLogsChannelId = channelId;
    await cfg.save();

    return interaction.editReply({
      content: `✅ War Logs channel set to <#${channelId}>.`
    });
  } catch (error) {
    LoggerService.error('Error saving War Logs channel:', { error: error?.message });
    const msg = {
      content: '❌ Could not save the War Logs channel.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
