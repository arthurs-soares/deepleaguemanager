const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive channel selection for wager transcripts and save
 * CustomId: config:channels:selectWagerTranscripts
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.wagerTranscriptsChannelId = channelId;
    await cfg.save();

    return interaction.editReply({ content: `✅ Wager transcripts channel set to <#${channelId}>.` });
  } catch (error) {
    LoggerService.error('Error saving wager transcripts channel:', { error: error?.message });
    const msg = { content: '❌ Could not save the wager transcripts channel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
