const { setLeaderboardChannel } = require('../../utils/system/serverSettings');
const { upsertLeaderboardMessage } = require('../../utils/user/leaderboard');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive channel selection for leaderboard, save and publish/update the message
 * CustomId: config:channels:selectLeaderboard
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    await setLeaderboardChannel(interaction.guild.id, channelId);

    // Try to publish/update now (not critical if it fails)
    try {
      await upsertLeaderboardMessage(interaction.guild);
    } catch (err) {
      LoggerService.warn('Failed to publish leaderboard:', { error: err?.message });
    }

    return interaction.editReply({ content: '✅ Leaderboard channel configured.' });
  } catch (error) {
    LoggerService.error('Error saving leaderboard channel:', { error: error?.message });
    const msg = { content: '❌ Could not save.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

