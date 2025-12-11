const mongoose = require('mongoose');

/**
 * Record of a war between two guilds
 */
const warSchema = new mongoose.Schema({
  discordGuildId: { type: String, required: true, index: true },
  guildAId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', required: true },
  guildBId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', required: true },
  // Region where the war takes place (for multi-region support)
  region: {
    type: String,
    enum: ['Europe', 'South America', 'NA East', 'NA West'],
    default: null
  },
  scheduledAt: { type: Date, required: true },
  // New: ID of the channel created for the war (replaces threads)
  channelId: { type: String, default: null },
  // Legacy: threadId kept for historical compatibility
  threadId: { type: String, default: null },
  status: { type: String, enum: ['aberta', 'finalizada', 'cancelada', 'dodge'], default: 'aberta' },
  winnerGuildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null },
  dodgedByGuildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null },
  requestedByGuildId: { type: mongoose.Schema.Types.ObjectId, ref: 'Guild', default: null },
  closedByUserId: { type: String, default: null },
  closedAt: { type: Date, default: null },
  // Acceptance tracking to prevent multiple acceptances
  acceptedAt: { type: Date, default: null },
  acceptedByUserId: { type: String, default: null },
  // Claim tracking for hosters
  claimedAt: { type: Date, default: null },
  claimedByUserId: { type: String, default: null },
  // Inactivity tracking for 7-day warning system
  lastInactivityWarningAt: { type: Date, default: null },
  inactivityReactivatedAt: { type: Date, default: null },
}, { timestamps: true });

// Indexes for common queries
warSchema.index({ discordGuildId: 1, scheduledAt: -1 });
warSchema.index({ discordGuildId: 1, status: 1, scheduledAt: -1 });
warSchema.index({ discordGuildId: 1, guildAId: 1, guildBId: 1 });


module.exports = mongoose.models.War || mongoose.model('War', warSchema);

