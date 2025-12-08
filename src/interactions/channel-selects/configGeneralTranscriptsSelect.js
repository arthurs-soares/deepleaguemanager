const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive channel selection for general ticket transcripts and save
 * CustomId: config:channels:selectGeneralTranscripts
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.generalTranscriptsChannelId = channelId;
    await cfg.save();

    return interaction.editReply({ content: `✅ General transcripts channel set to <#${channelId}>.` });
  } catch (error) {
    LoggerService.error('Error saving general transcripts channel:', { error: error?.message });
    const msg = { content: '❌ Could not save the general transcripts channel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
