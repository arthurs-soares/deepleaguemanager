/**
 * Helper functions for roster forum synchronization
 * Extracted to comply with max-lines rule
 */
const { ChannelType, MessageFlags } = require('discord.js');
const { buildGuildDetailDisplayComponents } = require('../embeds/guildDetailEmbed');

/**
 * In-memory locks to prevent concurrent sync operations
 * Key: `${discordGuildId}:${forumId}` Value: Promise
 */
const syncLocks = new Map();

/**
 * Acquire a lock for forum sync to prevent race conditions
 * @param {string} lockKey - Unique key for the lock
 * @returns {Promise<Function>} Release function
 */
async function acquireSyncLock(lockKey) {
  while (syncLocks.has(lockKey)) {
    await syncLocks.get(lockKey);
  }
  let release;
  const lockPromise = new Promise(resolve => { release = resolve; });
  syncLocks.set(lockKey, lockPromise);
  return () => {
    syncLocks.delete(lockKey);
    release();
  };
}

/**
 * Render the roster post content for a guild using Components v2
 * @param {Object} guildDoc - Guild document from database
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} [regionFilter] - Region to display stats for
 */
async function buildRosterPostContent(guildDoc, discordGuild, regionFilter) {
  const container = await buildGuildDetailDisplayComponents(
    guildDoc, discordGuild, regionFilter, { showRegionSelector: false }
  );
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/**
 * Map region filter to guild schema region values
 */
function getRegionValues(regionFilter) {
  switch (regionFilter) {
    case 'South America': return ['South America'];
    case 'NA': return ['NA East', 'NA West'];
    case 'Europe': return ['Europe'];
    default: return null;
  }
}

/**
 * Get display region for a guild based on the forum filter
 */
function getDisplayRegionForForum(guildDoc, regionFilter) {
  if (!regionFilter) return null;
  const regionValues = getRegionValues(regionFilter);
  if (!regionValues) return null;
  const activeRegions = (guildDoc.regions || []).filter(r => r.status === 'active');
  const matchingRegion = activeRegions.find(r => regionValues.includes(r.region));
  return matchingRegion?.region || null;
}

/**
 * Get the appropriate forum channel ID based on region filter
 */
function getForumChannelId(settings, regionFilter) {
  switch (regionFilter) {
    case 'South America': return settings.rosterForumSAChannelId;
    case 'NA': return settings.rosterForumNAChannelId;
    case 'Europe': return settings.rosterForumEUChannelId;
    default: return settings.rosterForumChannelId;
  }
}

/**
 * Find roster thread by title in a specific forum
 */
async function findRosterThreadInForum(discordGuild, forumId, title) {
  const forum = forumId ? discordGuild.channels.cache.get(forumId) : null;
  if (!forum || forum.type !== ChannelType.GuildForum) return null;
  const active = await forum.threads.fetchActive();
  const activeThread = active.threads.find(t => t.name === title);
  if (activeThread) return activeThread;
  try {
    const archived = await forum.threads.fetchArchived({ fetchAll: true });
    return archived.threads.find(t => t.name === title) || null;
  } catch (_) { return null; }
}

module.exports = {
  syncLocks,
  acquireSyncLock,
  buildRosterPostContent,
  getRegionValues,
  getDisplayRegionForForum,
  getForumChannelId,
  findRosterThreadInForum
};
