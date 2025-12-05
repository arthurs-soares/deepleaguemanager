const { ChannelType, MessageFlags } = require('discord.js');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const Guild = require('../../models/guild/Guild');
const { buildGuildDetailDisplayComponents } = require('../embeds/guildDetailEmbed');
const LoggerService = require('../../services/LoggerService');

/**
 * Render the roster post content for a guild using Components v2
 * @param {Object} guildDoc - Guild document from database
 * @param {import('discord.js').Guild} discordGuild - Discord guild for icon fallback
 * @param {string} [regionFilter] - Region to display stats for
 */
async function buildRosterPostContent(guildDoc, discordGuild, regionFilter = null) {
  // For forum posts, pass the specific region and disable region selector
  const container = await buildGuildDetailDisplayComponents(
    guildDoc,
    discordGuild,
    regionFilter,
    { showRegionSelector: false }
  );
  // Return Components v2 payload
  return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

/**
 * Map region filter to guild schema region values
 */
function getRegionValues(regionFilter) {
  switch (regionFilter) {
    case 'South America':
      return ['South America'];
    case 'NA':
      return ['NA East', 'NA West'];
    case 'Europe':
      return ['Europe'];
    default:
      return null; // All regions
  }
}

/**
 * Get the display region for a guild based on the forum filter
 * For multi-region guilds, returns the first matching region for the filter
 * @param {Object} guildDoc - Guild document
 * @param {string} regionFilter - Region filter ('South America', 'NA', 'Europe')
 * @returns {string|null} Region name to display
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
    case 'South America':
      return settings.rosterForumSAChannelId;
    case 'NA':
      return settings.rosterForumNAChannelId;
    case 'Europe':
      return settings.rosterForumEUChannelId;
    default:
      return settings.rosterForumChannelId;
  }
}

/**
 * Find roster thread by title in a specific forum (active and archived)
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} forumId - Forum channel ID
 * @param {string} title - Thread title (guild name)
 * @returns {Promise<Object|null>} Thread object or null
 */
async function findRosterThreadInForum(discordGuild, forumId, title) {
  const forum = forumId ? discordGuild.channels.cache.get(forumId) : null;
  if (!forum || forum.type !== ChannelType.GuildForum) return null;

  // Search in active threads first
  const active = await forum.threads.fetchActive();
  const activeThread = active.threads.find(t => t.name === title);
  if (activeThread) return activeThread;

  // Search in archived threads if not found in active
  try {
    const archived = await forum.threads.fetchArchived({ fetchAll: true });
    return archived.threads.find(t => t.name === title) || null;
  } catch (_) {
    return null;
  }
}

/**
 * Delete the roster thread for a specific guild from ALL roster forums
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {string} guildName - Guild name (thread title)
 * @returns {Promise<boolean>} True if at least one thread was deleted
 */
async function removeGuildRosterThread(discordGuild, guildName) {
  let deleted = false;
  try {
    const settings = await getOrCreateServerSettings(discordGuild.id);
    const forumIds = [
      settings.rosterForumChannelId,
      settings.rosterForumSAChannelId,
      settings.rosterForumNAChannelId,
      settings.rosterForumEUChannelId
    ].filter(Boolean);

    for (const forumId of forumIds) {
      try {
        const thread = await findRosterThreadInForum(
          discordGuild,
          forumId,
          guildName
        );
        if (thread) {
          await thread.delete('Guild deleted');
          deleted = true;
        }
      } catch (err) {
        LoggerService.warn('Failed to delete roster thread', {
          forumId,
          guildName,
          error: err?.message
        });
      }
    }
  } catch (error) {
    LoggerService.warn('Failed to remove roster threads', {
      guildName,
      error: error?.message
    });
  }
  return deleted;
}

/**
 * Synchronize the roster forum: create/update posts for each guild
 * - Create topics for guilds without topic
 * - Update the first post of the topic to reflect the current roster
 * - Delete topics of removed or inactive guilds
 * @param {import('discord.js').Guild} discordGuild - The Discord guild
 * @param {string} [regionFilter] - Optional region filter
 */
async function syncRosterForum(discordGuild, regionFilter = null) {
  const settings = await getOrCreateServerSettings(discordGuild.id);
  const forumId = getForumChannelId(settings, regionFilter);
  const forum = forumId ? discordGuild.channels.cache.get(forumId) : null;
  if (!forum || forum.type !== ChannelType.GuildForum) return;

  // Build query filter based on region (only active guilds)
  // Multi-region guilds use regions array with region objects
  const query = {
    discordGuildId: discordGuild.id,
    status: { $in: ['ativa', 'active'] }
  };
  const regionValues = getRegionValues(regionFilter);
  if (regionValues) {
    // Query guilds that have at least one active region matching filter
    query['regions'] = {
      $elemMatch: {
        region: { $in: regionValues },
        status: 'active'
      }
    };
  }

  const guilds = await Guild.find(query).sort({ createdAt: 1 });

  // Map existing threads by title (guild name) - active and archived
  // Also track duplicates to delete them
  const titleToThread = new Map();
  const duplicatesToDelete = [];

  const active = await forum.threads.fetchActive();
  active.threads.forEach(t => {
    if (titleToThread.has(t.name)) {
      // Duplicate found - mark older one for deletion (keep newer)
      const existing = titleToThread.get(t.name);
      if (t.createdTimestamp > existing.createdTimestamp) {
        duplicatesToDelete.push(existing);
        titleToThread.set(t.name, t);
      } else {
        duplicatesToDelete.push(t);
      }
    } else {
      titleToThread.set(t.name, t);
    }
  });

  // Also fetch archived threads to clean them up
  try {
    const archived = await forum.threads.fetchArchived({ fetchAll: true });
    archived.threads.forEach(t => {
      if (titleToThread.has(t.name)) {
        // Duplicate - delete the archived one
        duplicatesToDelete.push(t);
      } else {
        titleToThread.set(t.name, t);
      }
    });
  } catch (_) { /* ignore */ }

  // Delete duplicate threads
  for (const dup of duplicatesToDelete) {
    try {
      await dup.delete('Duplicate roster thread cleanup');
      LoggerService.info('Deleted duplicate roster thread', { name: dup.name });
    } catch (_) { /* ignore */ }
  }

  const expectedTitles = new Set(guilds.map(g => g.name));

  // Create/update
  for (const g of guilds) {
    const title = g.name;
    // Get the specific region to display for this forum
    const displayRegion = getDisplayRegionForForum(g, regionFilter);

    let thread = titleToThread.get(title);
    if (!thread) {
      // Create thread
      try {
        thread = await forum.threads.create({
          name: title,
          message: await buildRosterPostContent(g, discordGuild, displayRegion)
        });
        // Add to map to prevent duplicates in same run
        titleToThread.set(title, thread);
      } catch (createErr) {
        // Thread might already exist (race condition), try to find it
        LoggerService.warn('Failed to create roster thread, may already exist', {
          guildName: title,
          error: createErr?.message
        });
        continue;
      }
    } else {
      // Unarchive if archived
      if (thread.archived) {
        try { await thread.setArchived(false); } catch (_) { /* ignore */ }
      }
      // Update first post if possible
      try {
        const starterMessage = await thread.fetchStarterMessage();
        if (starterMessage) {
          const payload = await buildRosterPostContent(g, discordGuild, displayRegion);
          await starterMessage.edit(payload);
        }
      } catch (_) { /* ignore */ }
    }
  }

  // Delete topics that no longer correspond to any guild
  for (const [title, thread] of titleToThread.entries()) {
    if (!expectedTitles.has(title)) {
      try {
        await thread.delete('Guild no longer exists or inactive');
      } catch (_) { /* ignore */ }
    }
  }
}

/**
 * Synchronize all roster forums (general + region-specific)
 * @param {import('discord.js').Guild} discordGuild - The Discord guild
 */
async function syncAllRosterForums(discordGuild) {
  const settings = await getOrCreateServerSettings(discordGuild.id);

  // Sync general forum if configured
  if (settings.rosterForumChannelId) {
    await syncRosterForum(discordGuild, null);
  }

  // Sync region-specific forums if configured
  if (settings.rosterForumSAChannelId) {
    await syncRosterForum(discordGuild, 'South America');
  }
  if (settings.rosterForumNAChannelId) {
    await syncRosterForum(discordGuild, 'NA');
  }
  if (settings.rosterForumEUChannelId) {
    await syncRosterForum(discordGuild, 'Europe');
  }
}

module.exports = { syncRosterForum, syncAllRosterForums, removeGuildRosterThread };

