const mongoose = require('mongoose');

/**
 * Server settings (Discord guild)
 * - Stores war/wager tickets channels and categories
 * - Stores forum channel for guild roster posts
 * - Stores logs, leaderboard and notifications channels
 */
const serverSettingsSchema = new mongoose.Schema({
  discordGuildId: { type: String, required: true, index: true, unique: true },
  warTicketsChannelId: { type: String, default: null },
  wagerTicketsChannelId: { type: String, default: null },
  generalTicketsChannelId: { type: String, default: null },
  logsChannelId: { type: String, default: null },
  rosterForumChannelId: { type: String, default: null },
  warCategoryId: { type: String, default: null },
  wagerCategoryId: { type: String, default: null },
  generalTicketsCategoryId: { type: String, default: null },
  leaderboardChannelId: { type: String, default: null },
  leaderboardMessageId: { type: String, default: null },
  wagerLeaderboardChannelId: { type: String, default: null },
  wagerLeaderboardMessageId: { type: String, default: null },
  eventPointsLeaderboardChannelId: { type: String, default: null },
  eventPointsLeaderboardMessageId: { type: String, default: null },
  warDodgeChannelId: { type: String, default: null },
  dmWarningChannelId: { type: String, default: null },
  warLogsChannelId: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.models.ServerSettings || mongoose.model('ServerSettings', serverSettingsSchema);

