/**
 * Roster Forum Sync Operations - extracted for max-lines compliance
 */
const Guild = require('../../models/guild/Guild');
const LoggerService = require('../../services/LoggerService');
const {
  buildRosterPostContent, getRegionValues, getDisplayRegionForForum
} = require('./rosterForumHelpers');

/** Fetch guilds to sync for a region */
async function fetchGuildsForSync(discordGuildId, regionFilter) {
  const query = { discordGuildId, status: { $in: ['ativa', 'active'] } };
  const regionValues = getRegionValues(regionFilter);
  if (regionValues) {
    query['regions'] = {
      $elemMatch: { region: { $in: regionValues }, status: 'active' }
    };
  }
  return Guild.find(query).sort({ createdAt: 1 });
}

/** Build map of existing threads and identify duplicates */
async function buildThreadMap(forum) {
  const titleToThread = new Map();
  const duplicates = [];
  const active = await forum.threads.fetchActive();
  active.threads.forEach(t => {
    if (titleToThread.has(t.name)) {
      const existing = titleToThread.get(t.name);
      if (t.createdTimestamp > existing.createdTimestamp) {
        duplicates.push(existing); titleToThread.set(t.name, t);
      } else { duplicates.push(t); }
    } else { titleToThread.set(t.name, t); }
  });
  try {
    const archived = await forum.threads.fetchArchived({ fetchAll: true });
    archived.threads.forEach(t => {
      if (titleToThread.has(t.name)) duplicates.push(t);
      else titleToThread.set(t.name, t);
    });
  } catch (_) { /* ignore */ }
  return { titleToThread, duplicates };
}

/** Delete duplicate threads */
async function deleteDuplicates(duplicates) {
  for (const dup of duplicates) {
    try {
      await dup.delete('Duplicate roster thread cleanup');
      LoggerService.info('Deleted duplicate roster thread', { name: dup.name });
    } catch (_) { /* ignore */ }
  }
}

/** Create or update guild threads */
async function syncGuildThreads(guilds, forum, discordGuild, regionFilter, titleToThread) {
  for (const g of guilds) {
    const title = g.name;
    const displayRegion = getDisplayRegionForForum(g, regionFilter);
    let thread = titleToThread.get(title);
    // Double-check before creating to prevent race conditions
    if (!thread) {
      try {
        const freshActive = await forum.threads.fetchActive();
        thread = freshActive.threads.find(t => t.name === title);
        if (thread) titleToThread.set(title, thread);
      } catch (_) { /* ignore */ }
    }
    if (!thread) {
      try {
        const content = await buildRosterPostContent(g, discordGuild, displayRegion);
        thread = await forum.threads.create({ name: title, message: content });
        titleToThread.set(title, thread);
      } catch (err) {
        LoggerService.warn('Failed to create roster thread', {
          guildName: title, error: err?.message
        });
        continue;
      }
    } else {
      if (thread.archived) {
        try { await thread.setArchived(false); } catch (_) { /* ignore */ }
      }
      try {
        const starter = await thread.fetchStarterMessage();
        if (starter) {
          const content = await buildRosterPostContent(g, discordGuild, displayRegion);
          await starter.edit(content);
        }
      } catch (_) { /* ignore */ }
    }
  }
}

module.exports = { fetchGuildsForSync, buildThreadMap, deleteDuplicates, syncGuildThreads };
