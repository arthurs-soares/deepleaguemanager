/**
 * Roster Forum Synchronization
 * Creates/updates forum threads for each registered guild
 */
const { ChannelType } = require('discord.js');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const LoggerService = require('../../services/LoggerService');
const {
  acquireSyncLock,
  getForumChannelId,
  findRosterThreadInForum
} = require('./rosterForumHelpers');
const {
  fetchGuildsForSync,
  buildThreadMap,
  deleteDuplicates,
  syncGuildThreads
} = require('./rosterForumOps');

/**
 * Delete roster thread for a guild from ALL roster forums
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} guildName - Guild name (thread title)
 * @returns {Promise<boolean>} True if at least one deleted
 */
async function removeGuildRosterThread(discordGuild, guildName) {
  let deleted = false;
  const settings = await getOrCreateServerSettings(discordGuild.id);
  const forumIds = [
    settings.rosterForumChannelId,
    settings.rosterForumSAChannelId,
    settings.rosterForumNAChannelId,
    settings.rosterForumEUChannelId
  ].filter(Boolean);
  for (const forumId of forumIds) {
    try {
      const thread = await findRosterThreadInForum(discordGuild, forumId, guildName);
      if (thread) {
        await thread.delete('Guild deleted');
        deleted = true;
      }
    } catch (err) {
      LoggerService.warn('Failed to delete roster thread', {
        forumId, guildName, error: err?.message
      });
    }
  }
  return deleted;
}

/**
 * Synchronize the roster forum with locking to prevent duplicates
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} [regionFilter] - Optional region filter
 */
async function syncRosterForum(discordGuild, regionFilter = null) {
  const settings = await getOrCreateServerSettings(discordGuild.id);
  const forumId = getForumChannelId(settings, regionFilter);
  const forum = forumId ? discordGuild.channels.cache.get(forumId) : null;
  if (!forum || forum.type !== ChannelType.GuildForum) return;
  const lockKey = `${discordGuild.id}:${forumId}`;
  const releaseLock = await acquireSyncLock(lockKey);
  try {
    await performForumSync(discordGuild, forum, regionFilter);
  } finally { releaseLock(); }
}

/**
 * Internal sync logic (called with lock held)
 */
async function performForumSync(discordGuild, forum, regionFilter) {
  const guilds = await fetchGuildsForSync(discordGuild.id, regionFilter);
  const { titleToThread, duplicates } = await buildThreadMap(forum);
  await deleteDuplicates(duplicates);
  const expectedTitles = new Set(guilds.map(g => g.name));
  await syncGuildThreads(guilds, forum, discordGuild, regionFilter, titleToThread);
  // Delete orphaned threads
  for (const [title, thread] of titleToThread.entries()) {
    if (!expectedTitles.has(title)) {
      try { await thread.delete('Guild no longer exists or inactive'); } catch (_) {}
    }
  }
}

/**
 * Synchronize all roster forums (general + region-specific)
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 */
async function syncAllRosterForums(discordGuild) {
  const settings = await getOrCreateServerSettings(discordGuild.id);
  if (settings.rosterForumChannelId) await syncRosterForum(discordGuild, null);
  if (settings.rosterForumSAChannelId) await syncRosterForum(discordGuild, 'South America');
  if (settings.rosterForumNAChannelId) await syncRosterForum(discordGuild, 'NA');
  if (settings.rosterForumEUChannelId) await syncRosterForum(discordGuild, 'Europe');
}

module.exports = { syncRosterForum, syncAllRosterForums, removeGuildRosterThread };
