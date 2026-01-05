const WagerTicket = require('../../models/wager/WagerTicket');

const MAX_OPEN_WAGER_TICKETS = 3;

/**
 * Count open wager tickets for a user
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @returns {Promise<number>}
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

/**
 * Check if a member has the no-wagers role
 */
function hasNoWagersRole(member, noWagersRoleId) {
  if (!member || !noWagersRoleId) return false;
  return member.roles.cache.has(noWagersRoleId);
}

/**
 * Validate wager participants (roles, limits)
 * @param {Guild} guild - Discord guild
 * @param {string[]} userIds - All participant IDs
 * @param {string} initiatorId - Initiator ID
 * @param {Object} roleCfg - Role config
 * @returns {Promise<string|null>} Error message or null
 */
async function validateWagerParticipants(guild, userIds, initiatorId, roleCfg) {
  for (const uid of userIds) {
    const member = await guild.members.fetch(uid).catch(() => null);
    if (!member) continue;

    if (hasNoWagersRole(member, roleCfg?.noWagersRoleId)) {
      return uid === initiatorId
        ? '❌ You have opted out of wagers.'
        : `❌ <@${uid}> has opted out of wagers.`;
    }

    if (roleCfg?.blacklistRoleIds?.some(id => member.roles.cache.has(id))) {
      return uid === initiatorId
        ? '❌ You are blacklisted from wagers.'
        : `❌ <@${uid}> is blacklisted from wagers.`;
    }

    const tickets = await countOpenWagerTickets(guild.id, uid);
    if (tickets >= MAX_OPEN_WAGER_TICKETS) {
      return uid === initiatorId
        ? `❌ You have **${MAX_OPEN_WAGER_TICKETS}** open tickets.`
        : `❌ <@${uid}> has **${MAX_OPEN_WAGER_TICKETS}** open tickets.`;
    }
  }

  return null;
}

module.exports = {
  countOpenWagerTickets,
  MAX_OPEN_WAGER_TICKETS,
  hasNoWagersRole,
  validateWagerParticipants
};
