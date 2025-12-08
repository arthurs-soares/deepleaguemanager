const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive channel selection for war transcripts and save
 * CustomId: config:channels:selectWarTranscripts
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.warTranscriptsChannelId = channelId;
    await cfg.save();

    return interaction.editReply({ content: `✅ War transcripts channel set to <#${channelId}>.` });
  } catch (error) {
    LoggerService.error('Error saving war transcripts channel:', { error: error?.message });
    const msg = { content: '❌ Could not save the war transcripts channel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
