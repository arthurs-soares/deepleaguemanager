const mongoose = require('mongoose');

/**
 * Wager Ticket between two users (1v1) or four users (2v2)
 */
const wagerTicketSchema = new mongoose.Schema({
  discordGuildId: { type: String, required: true, index: true },
  channelId: { type: String, required: true, index: true },
  initiatorUserId: { type: String, required: true },
  opponentUserId: { type: String, required: true },
  // 2v2 wager support
  is2v2: { type: Boolean, default: false },
  initiatorTeammateId: { type: String, default: null },
  opponentTeammateId: { type: String, default: null },
  // Distinguish war wagers from regular wagers
  isWar: { type: Boolean, default: false },
  dodgedByUserId: { type: String, default: null },
  status: { type: String, enum: ['open', 'dodge', 'closed'], default: 'open' },
  closedByUserId: { type: String, default: null },
  closedAt: { type: Date, default: null },
  // Acceptance tracking to prevent multiple acceptances
  acceptedAt: { type: Date, default: null },
  acceptedByUserId: { type: String, default: null },
  // Claim tracking - only the hoster who claimed can manage the ticket
  claimedAt: { type: Date, default: null },
  claimedByUserId: { type: String, default: null },
}, { timestamps: true });

wagerTicketSchema.index({ discordGuildId: 1, channelId: 1 });

module.exports = mongoose.models.WagerTicket || mongoose.model('WagerTicket', wagerTicketSchema);

