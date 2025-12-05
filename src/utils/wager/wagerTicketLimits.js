const WagerTicket = require('../../models/wager/WagerTicket');

/**
 * Count open wager tickets for a user (as initiator, opponent, or teammate)
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @returns {Promise<number>} - Number of open tickets
 */
async function countOpenWagerTickets(guildId, userId) {
  const count = await WagerTicket.countDocuments({
    discordGuildId: guildId,
    status: 'open',
    $or: [
      { initiatorUserId: userId },
      { opponentUserId: userId },
      { initiatorTeammateId: userId },
      { opponentTeammateId: userId }
    ]
  });

  return count;
}

module.exports = { countOpenWagerTickets };
