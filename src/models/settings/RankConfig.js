const mongoose = require('mongoose');

/**
 * Rank configurations per server
 * Each rank requires a certain number of wins to achieve
 * - Iron 1-3: 2, 4, 6 wins
 * - Silver 1-3: 8, 10, 12 wins
 * - Gold 1-3: 14, 16, 18 wins
 * - Platinum 1-3: 20, 22, 24 wins
 * - Diamond 1-2: 26, 28 wins
 * - Master: 30 wins
 * - Grand Master: 35 wins
 * - Top 10: Top 10 Most wins
 */
const rankConfigSchema = new mongoose.Schema({
  discordGuildId: { type: String, required: true, index: true, unique: true },

  // Iron Ranks (2, 4, 6 wins)
  iron1RoleId: { type: String, default: null },
  iron2RoleId: { type: String, default: null },
  iron3RoleId: { type: String, default: null },

  // Silver Ranks (8, 10, 12 wins)
  silver1RoleId: { type: String, default: null },
  silver2RoleId: { type: String, default: null },
  silver3RoleId: { type: String, default: null },

  // Gold Ranks (14, 16, 18 wins)
  gold1RoleId: { type: String, default: null },
  gold2RoleId: { type: String, default: null },
  gold3RoleId: { type: String, default: null },

  // Platinum Ranks (20, 22, 24 wins)
  platinum1RoleId: { type: String, default: null },
  platinum2RoleId: { type: String, default: null },
  platinum3RoleId: { type: String, default: null },

  // Diamond Ranks (26, 28 wins)
  diamond1RoleId: { type: String, default: null },
  diamond2RoleId: { type: String, default: null },

  // High Elo Ranks
  masterRoleId: { type: String, default: null },        // 30 wins
  grandMasterRoleId: { type: String, default: null },   // 35 wins
  top10RoleId: { type: String, default: null },         // Top 10 Most wins
}, { timestamps: true });

module.exports = mongoose.models.RankConfig || mongoose.model('RankConfig', rankConfigSchema);
