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
  // Region-specific roster forums
  rosterForumSAChannelId: { type: String, default: null },
  rosterForumNAChannelId: { type: String, default: null },
  rosterForumEUChannelId: { type: String, default: null },
  // Region-specific war categories
  warCategorySAId: { type: String, default: null },
  warCategoryNAEId: { type: String, default: null },
  warCategoryNAWId: { type: String, default: null },
  warCategoryEUId: { type: String, default: null },
  warCategorySAId2: { type: String, default: null },
  warCategoryNAEId2: { type: String, default: null },
  warCategoryNAWId2: { type: String, default: null },
  warCategoryEUId2: { type: String, default: null },
  // Wager categories (up to 3 for overflow)
  wagerCategoryId: { type: String, default: null },
  wagerCategoryId2: { type: String, default: null },
  wagerCategoryId3: { type: String, default: null },
  generalTicketsCategoryId: { type: String, default: null },
  leaderboardChannelId: { type: String, default: null },
  leaderboardMessageId: { type: String, default: null },
  wagerLeaderboardChannelId: { type: String, default: null },
  wagerLeaderboardMessageId: { type: String, default: null },
  eventPointsLeaderboardChannelId: { type: String, default: null },
  eventPointsLeaderboardMessageId: { type: String, default: null },
  warDodgeChannelId: { type: String, default: null },
  wagerDodgeChannelId: { type: String, default: null },
  dmWarningChannelId: { type: String, default: null },
  warLogsChannelId: { type: String, default: null },
  // Transcript channels (separate from logs)
  warTranscriptsChannelId: { type: String, default: null },
  wagerTranscriptsChannelId: { type: String, default: null },
  generalTranscriptsChannelId: { type: String, default: null },
  // Toggle settings
  hosterPingEnabled: { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.models.ServerSettings || mongoose.model('ServerSettings', serverSettingsSchema);

