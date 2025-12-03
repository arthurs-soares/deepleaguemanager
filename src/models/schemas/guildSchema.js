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

  // Rosters (user lists by Discord ID)
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

  // War statistics
  wins: { type: Number, default: 0, min: 0 },
  losses: { type: Number, default: 0, min: 0 },

  // ELO rating (0-5000), default 1000 for all guilds
  elo: { type: Number, default: 1000, min: 0, max: 5000 },

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

module.exports = { guildSchema, memberSchema };
