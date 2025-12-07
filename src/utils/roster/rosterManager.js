const Guild = require('../../models/guild/Guild');
const { isDatabaseConnected } = require('../../config/database');
const {
  getGuildTransitionStatus,
  formatRemaining
} = require('../rate-limiting/guildTransitionCooldown');
const { getUserGuildInfo } = require('../guilds/userGuildInfo');
const {
  logGuildMemberJoin,
  logGuildMemberLeave
} = require('../guilds/activityLogger');
const { ensureRegionsArray } = require('../guilds/guildDocHelpers');
const LoggerService = require('../../services/LoggerService');
const {
  getRegionData,
  getRegionRosters,
  isUserInRegionRoster,
  isUserInAnyGuildRoster,
  getAllRosterMembers
} = require('./rosterHelpers');

/**
 * Get a guild by its MongoDB ID
 * @param {string} guildId - Guild document ID (Mongo)
 * @returns {Promise<import('../../models/guild/Guild')|null>}
 */
async function getGuildById(guildId) {
  try {
    return await Guild.findById(guildId);
  } catch (error) {
    LoggerService.error('Error fetching guild by ID:', error);
    return null;
  }
}

/**
 * Add a user to the specified roster for a specific region.
 * Users can be in multiple regions of the SAME guild.
 * Users CANNOT be in rosters of DIFFERENT guilds.
 * @param {string} guildId - Guild ID (Mongo)
 * @param {('main'|'sub')} roster - Roster type
 * @param {string} userId - Discord user ID
 * @param {string} region - Region name
 * @param {import('discord.js').Client} [client] - Optional client
 * @returns {Promise<{success:boolean, message:string, guild?:object}>}
 */
async function addToRoster(guildId, roster, userId, region, client = null) {
  try {
    if (!isDatabaseConnected()) {
      return {
        success: false,
        message: 'Database unavailable. Try again later.'
      };
    }

    const doc = await Guild.findById(guildId);
    if (!doc) return { success: false, message: 'Guild not found.' };

    const regionData = getRegionData(doc, region);
    if (!regionData) {
      return {
        success: false,
        message: `Guild is not registered in "${region}".`
      };
    }

    // Check cross-guild membership (user can only be in ONE guild)
    if (doc?.discordGuildId) {
      const { guild: existingGuild } = await getUserGuildInfo(
        doc.discordGuildId,
        userId
      );
      if (existingGuild && String(existingGuild._id) !== String(guildId)) {
        return {
          success: false,
          message: `User is already a member of "${existingGuild.name}".`
        };
      }
    }

    // Transition cooldown (only for joining DIFFERENT guild)
    try {
      const { active, remainingMs, lastLeftGuildId } =
        await getGuildTransitionStatus(doc.discordGuildId, userId);
      if (active && String(guildId) !== String(lastLeftGuildId)) {
        const remaining = formatRemaining(remainingMs);
        return {
          success: false,
          message: `Guild transition cooldown active. Wait ${remaining}.`
        };
      }
    } catch (_) { /* silent */ }

    const field = roster === 'main' ? 'mainRoster' : 'subRoster';
    const currentList = Array.isArray(regionData[field])
      ? regionData[field] : [];

    if (currentList.includes(userId)) {
      return {
        success: false,
        message: `User is already in ${roster} roster for ${region}.`
      };
    }

    if (currentList.length >= 5) {
      return {
        success: false,
        message: `${roster} roster is full for ${region} (limit: 5).`
      };
    }

    regionData[field] = [...currentList, userId];
    ensureRegionsArray(doc);
    await doc.save();

    try {
      let username = userId;
      if (client) {
        const user = await client.users.fetch(userId).catch(() => null);
        username = user?.username || user?.tag || userId;
      }
      await logGuildMemberJoin(
        doc.discordGuildId,
        String(doc._id),
        doc.name,
        userId,
        username,
        `${roster} (${region})`
      );
    } catch (_) { /* silent */ }

    return {
      success: true,
      message: `User added to ${roster} roster for ${region}.`,
      guild: doc
    };
  } catch (error) {
    LoggerService.error('Error adding to roster:', error);
    return { success: false, message: 'Internal error adding to roster.' };
  }
}

/**
 * Remove a user from the specified roster for a specific region
 * @param {string} guildId - Guild ID (Mongo)
 * @param {('main'|'sub')} roster - Roster type
 * @param {string} userId - Discord user ID
 * @param {string} region - Region name
 * @returns {Promise<{success:boolean, message:string, guild?:object}>}
 */
async function removeFromRoster(guildId, roster, userId, region) {
  try {
    const doc = await Guild.findById(guildId);
    if (!doc) return { success: false, message: 'Guild not found.' };

    const field = roster === 'main' ? 'mainRoster' : 'subRoster';
    const regionData = getRegionData(doc, region);

    // Check region-specific roster first
    const regionList = regionData && Array.isArray(regionData[field])
      ? regionData[field]
      : [];

    // Check legacy roster as fallback
    const legacyList = Array.isArray(doc[field]) ? doc[field] : [];

    // Determine where user is located
    const inRegion = regionList.includes(userId);
    const inLegacy = legacyList.includes(userId);

    if (!inRegion && !inLegacy) {
      return {
        success: false,
        message: `User is not in ${roster} roster for ${region}.`
      };
    }

    // Remove from region-specific roster if present
    if (inRegion && regionData) {
      regionData[field] = regionList.filter(id => id !== userId);
      ensureRegionsArray(doc);
    }

    // Remove from legacy roster if present (migration scenario)
    if (inLegacy) {
      doc[field] = legacyList.filter(id => id !== userId);
    }

    await doc.save();

    try {
      await logGuildMemberLeave(
        doc.discordGuildId,
        String(doc._id),
        doc.name,
        userId,
        userId,
        `${roster} (${region})`
      );
    } catch (_) { /* silent */ }

    return {
      success: true,
      message: `User removed from ${roster} roster for ${region}.`,
      guild: doc
    };
  } catch (error) {
    LoggerService.error('Error removing from roster:', error);
    return { success: false, message: 'Internal error removing from roster.' };
  }
}

module.exports = {
  getGuildById,
  getRegionData,
  getRegionRosters,
  isUserInRegionRoster,
  isUserInAnyGuildRoster,
  getAllRosterMembers,
  addToRoster,
  removeFromRoster,
};
