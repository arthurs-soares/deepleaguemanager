const { ChannelType, MessageFlags } = require('discord.js');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const Guild = require('../../models/guild/Guild');
const { buildGuildDetailDisplayComponents } = require('../embeds/guildDetailEmbed');
const LoggerService = require('../../services/LoggerService');

/**
 * Render the roster post content for a guild using Components v2
 * @param {Object} guildDoc - Guild document from database
 * @param {import('discord.js').Guild} discordGuild - Discord guild for icon fallback
 */
async function buildRosterPostContent(guildDoc, discordGuild) {
  const container = await buildGuildDetailDisplayComponents(guildDoc, discordGuild);
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
  const titleToThread = new Map();
  const active = await forum.threads.fetchActive();
  active.threads.forEach(t => titleToThread.set(t.name, t));

  // Also fetch archived threads to clean them up
  try {
    const archived = await forum.threads.fetchArchived({ fetchAll: true });
    archived.threads.forEach(t => {
      if (!titleToThread.has(t.name)) {
        titleToThread.set(t.name, t);
      }
    });
  } catch (_) { /* ignore */ }

  const expectedTitles = new Set(guilds.map(g => g.name));

  // Create/update
  for (const g of guilds) {
    const title = g.name;
    let thread = titleToThread.get(title);
    if (!thread) {
      // Create thread
      thread = await forum.threads.create({
        name: title,
        message: await buildRosterPostContent(g, discordGuild)
      });
    } else {
      // Unarchive if archived
      if (thread.archived) {
        try { await thread.setArchived(false); } catch (_) { /* ignore */ }
      }
      // Update first post if possible
      try {
        const starterMessage = await thread.fetchStarterMessage();
        if (starterMessage) {
          const payload = await buildRosterPostContent(g, discordGuild);
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

