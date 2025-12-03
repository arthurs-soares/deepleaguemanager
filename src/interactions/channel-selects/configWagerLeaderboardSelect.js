const { MessageFlags } = require('discord.js');
const {
  setWagerLeaderboardChannel
} = require('../../utils/system/serverSettings');
const {
  upsertWagerLeaderboardMessage
} = require('../../utils/wager/wagerLeaderboard');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive channel selection for wager leaderboard, save and publish/update
 * CustomId: config:channels:selectWagerLeaderboard
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) {
      return interaction.editReply({ content: 'Action cancelled.' });
    }

    await setWagerLeaderboardChannel(interaction.guild.id, channelId);

    // Try to publish/update now (not critical if it fails)
    try {
      await upsertWagerLeaderboardMessage(interaction.guild);
    } catch (err) {
      LoggerService.warn('Failed to publish wager leaderboard:', {
        error: err?.message
      });
    }

    return interaction.editReply({
      content: '✅ Wager Leaderboard channel configured.'
    });
  } catch (error) {
    LoggerService.error('Error saving wager leaderboard channel:', {
      error: error?.message
    });
    const msg = { content: '❌ Could not save.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
