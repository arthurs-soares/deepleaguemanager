const Guild = require('../../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../misc/roleConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * Get opponent guild ID based on requestedByGuildId
 * @param {import('../../models/war/War')} war
 * @returns {string|null} opponentGuildId or null if cannot infer
 */
function getOpponentGuildId(war) {
  if (!war) return null;
  if (!war.requestedByGuildId) return null;
  const req = String(war.requestedByGuildId);
  const a = String(war.guildAId);
  const b = String(war.guildBId);
  return req === a ? b : a;
}

/**
 * Check if the user is leader or co-leader of a specific guild
 * @param {string} userId
 * @param {string} guildId
 * @returns {Promise<import('../../models/guild/Guild')|null>}
 */
async function isLeaderOrCoLeader(userId, guildId) {
  if (!userId || !guildId) return null;
  return Guild.findOne({
    _id: guildId,
    members: {
      $elemMatch: { userId, role: { $in: ['lider', 'vice-lider'] } }
    },
  });
}

/**
 * Search for role IDs configured as hosters
 * @param {string} discordGuildId
 * @returns {Promise<string[]>}
 */
async function getHosterRoleIds(discordGuildId) {
  const cfg = await getOrCreateRoleConfig(discordGuildId);
  return Array.isArray(cfg?.hostersRoleIds) ? cfg.hostersRoleIds : [];
}

/**
 * Add all members with roles configured as Hosters to the war thread
 * Silent on errors – returns list of actually added IDs
 * @param {import('discord.js').Guild} discordGuild
 * @param {import('discord.js').ThreadChannel|null} thread
 * @returns {Promise<string[]>}
 */
async function addHostersToThread(discordGuild, thread) {
  const added = [];
  try {
    if (!discordGuild || !thread) {
      LoggerService.debug('[addHostersToThread] Missing discordGuild or thread');
      return added;
    }

    const cfg = await getOrCreateRoleConfig(discordGuild.id);
    const hosterRoleIds = cfg?.hostersRoleIds || [];

    if (!hosterRoleIds.length) {
      LoggerService.debug('[addHostersToThread] No hoster roles configured');
      return added;
    }

    const toAdd = new Set();
    for (const roleId of hosterRoleIds) {
      const role = discordGuild.roles.cache.get(roleId);
      if (!role) continue;

      for (const [memberId] of role.members) toAdd.add(memberId);
    }

    for (const userId of toAdd) {
      try {
        await thread.members.add(userId);
        added.push(userId);
      } catch (error) {
        LoggerService.debug('[addHostersToThread] Failed to add user', {
          userId,
          error: error.message
        });
      }
    }
  } catch (error) {
    LoggerService.error('[addHostersToThread] Unexpected error:', {
      error: error.message
    });
  }

  LoggerService.debug('[addHostersToThread] Complete', { usersAdded: added.length });
  return added;
}

/**
 * Update war region stats for winner and loser
 * @param {Object} winner - Winner guild doc
 * @param {Object} loser - Loser guild doc
 * @param {string} warRegion - Region of the war
 */
function updateWarRegionStats(winner, loser, warRegion) {
  if (!warRegion) return;

  const winnerRegionStats = winner.regions?.find(r => r.region === warRegion);
  const loserRegionStats = loser.regions?.find(r => r.region === warRegion);

  if (winnerRegionStats) {
    winnerRegionStats.wins = (winnerRegionStats.wins || 0) + 1;
  }
  if (loserRegionStats) {
    loserRegionStats.losses = (loserRegionStats.losses || 0) + 1;
  }
}

module.exports = {
  getOpponentGuildId,
  isLeaderOrCoLeader,
  getHosterRoleIds,
  addHostersToThread,
  updateWarRegionStats,
};

