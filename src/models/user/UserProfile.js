const mongoose = require('mongoose');

/**
 * User profile (global per user)
 */
const userProfileSchema = new mongoose.Schema({
  discordUserId: { type: String, required: true, index: true, unique: true },
  description: { type: String, trim: true, maxlength: 500 },
  bannerUrl: {
    type: String,
    trim: true,
    validate: { validator: v => !v || /^https?:\/\//i.test(v), message: 'Invalid banner URL.' }
  },
  color: {
    type: String,
    trim: true,
    validate: { validator: v => !v || /^#?[0-9a-fA-F]{6}$/.test(v), message: 'Invalid color (use 6-digit hex).' }
  },
  // General User ELO (global, 0-5000) - for general competitive rating
  elo: { type: Number, default: 800, min: 0, max: 5000, index: true },

  // General ELO stats
  wins: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },

  // Peak ELO tracking for general ELO
  peakElo: { type: Number, default: 800, min: 0, max: 5000 },
  peakDate: { type: Date, default: null },

  // Activity tracking for general ELO
  lastGameAt: { type: Date, default: null },

  // Individual Wager ELO (global, 0-5000)
  wagerElo: { type: Number, default: 800, min: 0, max: 5000, index: true },

  // Wager detailed stats
  wagerGamesPlayed: { type: Number, default: 0, min: 0 },
  wagerWins: { type: Number, default: 0, min: 0 },
  wagerLosses: { type: Number, default: 0, min: 0 },

  // Streaks
  wagerWinStreak: { type: Number, default: 0, min: 0 },
  wagerLossStreak: { type: Number, default: 0, min: 0 },
  wagerMaxWinStreak: { type: Number, default: 0, min: 0 },

  // Peak ELO tracking
  wagerPeakElo: { type: Number, default: 800, min: 0, max: 5000 },
  wagerPeakDate: { type: Date, default: null },

  // Activity/Decay tracking
  wagerLastWagerAt: { type: Date, default: null },
  wagerLastDecayAt: { type: Date, default: null },

  // Hoster stats
  hostedWagers: { type: Number, default: 0, min: 0 },
  hostedWars: { type: Number, default: 0, min: 0 },
  hostedDodges: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

module.exports = mongoose.models.UserProfile || mongoose.model('UserProfile', userProfileSchema);

