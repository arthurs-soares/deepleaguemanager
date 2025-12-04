const { getOrCreateRankConfig, RANK_DEFINITIONS } = require('../utils/misc/rankConfig');
const UserProfile = require('../models/user/UserProfile');
const LoggerService = require('./LoggerService');

/**
 * Get the appropriate rank for a given number of wins
 * @param {number} wins - Number of wager wins
 * @returns {string|null} - Rank key or null
 */
function getRankForWins(wins) {
  // Ordered from highest to lowest (excluding top10 which is special)
  const ranksOrdered = [
    { key: 'grandMaster', wins: 35 },
    { key: 'master', wins: 30 },
    { key: 'diamond2', wins: 28 },
    { key: 'diamond1', wins: 26 },
    { key: 'platinum3', wins: 24 },
    { key: 'platinum2', wins: 22 },
    { key: 'platinum1', wins: 20 },
    { key: 'gold3', wins: 18 },
    { key: 'gold2', wins: 16 },
    { key: 'gold1', wins: 14 },
    { key: 'silver3', wins: 12 },
    { key: 'silver2', wins: 10 },
    { key: 'silver1', wins: 8 },
    { key: 'iron3', wins: 6 },
    { key: 'iron2', wins: 4 },
    { key: 'iron1', wins: 2 }
  ];

  for (const rank of ranksOrdered) {
    if (wins >= rank.wins) {
      return rank.key;
    }
  }
  return null;
}

/**
 * Get all rank role IDs that should be removed (all configured ranks)
 * @param {Object} rankConfig - Rank configuration object
 * @returns {string[]} - Array of role IDs
 */
function getAllRankRoleIds(rankConfig) {
  const roleIds = [];
  const fields = [
    'iron1RoleId', 'iron2RoleId', 'iron3RoleId',
    'silver1RoleId', 'silver2RoleId', 'silver3RoleId',
    'gold1RoleId', 'gold2RoleId', 'gold3RoleId',
    'platinum1RoleId', 'platinum2RoleId', 'platinum3RoleId',
    'diamond1RoleId', 'diamond2RoleId',
    'masterRoleId', 'grandMasterRoleId', 'top10RoleId'
  ];

  for (const field of fields) {
    if (rankConfig[field]) {
      roleIds.push(rankConfig[field]);
    }
  }
  return roleIds;
}

/**
 * Update a user's rank role based on their wager wins
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} userId - User ID to update
 * @param {number} wagerWins - Current number of wager wins
 */
async function updateUserRank(discordGuild, userId, wagerWins) {
  try {
    const rankConfig = await getOrCreateRankConfig(discordGuild.id);
    const newRankKey = getRankForWins(wagerWins);

    // Get all configured rank role IDs
    const allRankRoles = getAllRankRoleIds(rankConfig);
    if (allRankRoles.length === 0) {
      return; // No ranks configured
    }

    // Get the new rank role ID
    const newRankRoleId = newRankKey
      ? rankConfig[`${newRankKey}RoleId`]
      : null;

    // Fetch the member
    let member;
    try {
      member = await discordGuild.members.fetch(userId);
    } catch (_) {
      return; // Member not in guild
    }

    // Remove all rank roles first
    const rolesToRemove = allRankRoles.filter(roleId =>
      member.roles.cache.has(roleId) && roleId !== newRankRoleId
    );

    for (const roleId of rolesToRemove) {
      try {
        await member.roles.remove(roleId);
      } catch (err) {
        LoggerService.warn('Failed to remove rank role:', {
          userId,
          roleId,
          error: err.message
        });
      }
    }

    // Add the new rank role if configured and not already assigned
    if (newRankRoleId && !member.roles.cache.has(newRankRoleId)) {
      try {
        await member.roles.add(newRankRoleId);
        const rankDef = RANK_DEFINITIONS[newRankKey];
        LoggerService.info('Rank role assigned:', {
          userId,
          rank: rankDef?.name || newRankKey,
          wins: wagerWins
        });
      } catch (err) {
        LoggerService.warn('Failed to add rank role:', {
          userId,
          roleId: newRankRoleId,
          error: err.message
        });
      }
    }
  } catch (error) {
    LoggerService.error('Error updating user rank:', {
      userId,
      error: error.message
    });
  }
}

/**
 * Update Top 10 ranks for a guild
 * Assigns top10RoleId to the top 10 users with most wager wins
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 */
async function updateTop10Ranks(discordGuild) {
  try {
    const rankConfig = await getOrCreateRankConfig(discordGuild.id);
    const top10RoleId = rankConfig.top10RoleId;

    if (!top10RoleId) {
      return; // Top 10 role not configured
    }

    // Fetch all guild members
    try {
      await discordGuild.members.fetch();
    } catch (_) {}

    const memberIds = [...discordGuild.members.cache
      .filter(m => !m.user?.bot)
      .keys()];

    // Get top 10 users by wager wins
    const topUsers = await UserProfile.find({
      discordUserId: { $in: memberIds },
      wagerWins: { $gt: 0 }
    })
      .sort({ wagerWins: -1 })
      .limit(10)
      .lean();

    const top10UserIds = new Set(topUsers.map(u => u.discordUserId));

    // Update roles for all members
    for (const [memberId, member] of discordGuild.members.cache) {
      if (member.user?.bot) continue;

      const shouldHaveTop10 = top10UserIds.has(memberId);
      const hasTop10 = member.roles.cache.has(top10RoleId);

      try {
        if (shouldHaveTop10 && !hasTop10) {
          await member.roles.add(top10RoleId);
        } else if (!shouldHaveTop10 && hasTop10) {
          await member.roles.remove(top10RoleId);
        }
      } catch (err) {
        LoggerService.warn('Failed to update Top 10 role:', {
          memberId,
          error: err.message
        });
      }
    }
  } catch (error) {
    LoggerService.error('Error updating Top 10 ranks:', {
      guildId: discordGuild.id,
      error: error.message
    });
  }
}

/**
 * Full rank update for a user after a wager result
 * Updates both the individual rank and Top 10
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} userId - User ID
 * @param {number} wagerWins - Current wager wins
 */
async function updateRanksAfterWager(discordGuild, userId, wagerWins) {
  await updateUserRank(discordGuild, userId, wagerWins);
  await updateTop10Ranks(discordGuild);
}

module.exports = {
  getRankForWins,
  updateUserRank,
  updateTop10Ranks,
  updateRanksAfterWager
};
