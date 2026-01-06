const mongoose = require('mongoose');

/**
 * Guild member sub-schema
 */
const memberSchema = new mongoose.Schema({
  userId: String,
  username: String,
  role: {
    type: String,
    enum: ['lider', 'vice-lider', 'membro', 'leader', 'co-leader', 'member'],
    default: 'membro'
  },
  joinedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

/**
 * Region stats sub-schema
 * Stores region-specific stats (wins, losses, ELO) and rosters
 */
const regionStatsSchema = new mongoose.Schema({
  region: {
    type: String,
    enum: ['Europe', 'South America', 'NA East', 'NA West', 'Asia'],
    required: true
  },
  wins: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },
  elo: { type: Number, default: 1000, min: 0, max: 5000 },
  registeredAt: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  // Region-specific rosters (user Discord IDs)
  mainRoster: {
    type: [String],
    default: []
  },
  subRoster: {
    type: [String],
    default: []
  }
}, { _id: false });

/**
 * Core guild schema with all field definitions
 */
const guildSchema = new mongoose.Schema({
  // Guild name
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Guild leader (display name)
  leader: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },

  // Discord user ID who registered the guild
  registeredBy: {
    type: String,
    required: true
  },

  // Discord server ID where it was registered
  discordGuildId: {
    type: String,
    required: true
  },

  // Multi-region support: array of region-specific stats
  regions: {
    type: [regionStatsSchema],
    default: [],
    validate: {
      validator: v => v.length >= 1,
      message: 'Guild must be registered in at least one region.'
    }
  },

  // Guild status (active, inactive, etc.)
  status: {
    type: String,
    enum: ['ativa', 'inativa', 'suspensa', 'active', 'inactive', 'suspended'],
    default: 'ativa'
  },

  // Appearance and optional information
  bannerUrl: {
    type: String,
    trim: true,
    validate: {
      validator: v => !v || /^https?:\/\//i.test(v),
      message: 'Invalid banner URL.'
    }
  },
  iconUrl: {
    type: String,
    trim: true,
    validate: {
      validator: v => !v || /^https?:\/\//i.test(v),
      message: 'Invalid icon URL.'
    }
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  color: {
    type: String,
    trim: true,
    validate: {
      validator: v => !v || /^#?[0-9a-fA-F]{6}$/.test(v),
      message: 'Invalid color. Use a 6-digit hex (ex: #FFAA00).'
    }
  },

  // Guild members
  members: [memberSchema],

  // LEGACY: Global rosters - kept for migration compatibility
  // New rosters are stored per-region in regions[].mainRoster/subRoster
  mainRoster: {
    type: [String],
    default: []
  },
  subRoster: {
    type: [String],
    default: []
  },

  // Guild managers (Discord user IDs, max 2)
  managers: {
    type: [String],
    default: [],
    validate: {
      validator: v => !v || v.length <= 2,
      message: 'Maximum of 2 managers allowed.'
    }
  },

  // Dates
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Virtuals for backward compatibility and stat aggregation from regions
guildSchema.virtual('wins').get(function () {
  if (this.regions && this.regions.length > 0) {
    return this.regions.reduce((sum, region) => sum + (region.wins || 0), 0);
  }
  return 0;
});

guildSchema.virtual('losses').get(function () {
  if (this.regions && this.regions.length > 0) {
    return this.regions.reduce((sum, region) => sum + (region.losses || 0), 0);
  }
  return 0;
});

// Ensure virtuals are included when converting to JSON/Object
guildSchema.set('toJSON', { virtuals: true });
guildSchema.set('toObject', { virtuals: true });

module.exports = { guildSchema, memberSchema, regionStatsSchema };
