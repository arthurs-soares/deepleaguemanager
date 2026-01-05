// Wager channel management utilities (mirrors war/channelManager with users)
const { ChannelType, PermissionFlagsBits } = require('discord.js');

/** Discord's maximum channels per category */
const MAX_CHANNELS_PER_CATEGORY = 50;

/**
 * Custom error for category channel limit
 */
class CategoryFullError extends Error {
  /**
   * @param {string} categoryName - Category name
   * @param {number} currentCount - Current channel count
   */
  constructor(categoryName, currentCount) {
    super(`Category "${categoryName}" has reached the maximum ` +
      `of ${MAX_CHANNELS_PER_CATEGORY} channels (${currentCount})`);
    this.name = 'CategoryFullError';
    this.categoryName = categoryName;
    this.currentCount = currentCount;
  }
}

/**
 * Custom error when all wager categories are full
 */
class AllCategoriesFullError extends Error {
  constructor() {
    super('All configured wager categories are full (50 channels each).');
    this.name = 'AllCategoriesFullError';
  }
}

/**
 * Custom error when server has reached 500 channel limit
 */
class ServerChannelLimitError extends Error {
  constructor() {
    super('Server has reached the maximum of 500 channels.');
    this.name = 'ServerChannelLimitError';
  }
}

/**
 * Check if a category has room for more channels
 * @param {import('discord.js').CategoryChannel} category
 * @returns {{ canCreate: boolean, count: number }}
 */
function checkCategoryCapacity(category) {
  const count = category.children.cache.size;
  return { canCreate: count < MAX_CHANNELS_PER_CATEGORY, count };
}

/**
 * Find an available wager category from the configured categories
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {Object} settings - Server settings with category IDs
 * @returns {{ category: import('discord.js').CategoryChannel, error: string|null }}
 */
function findAvailableWagerCategory(guild, settings) {
  const categoryIds = [
    settings.wagerCategoryId,
    settings.wagerCategoryId2,
    settings.wagerCategoryId3
  ].filter(Boolean);

  if (categoryIds.length === 0) {
    return {
      category: null,
      error: '⚠️ No wager categories configured. Set them in /config → Channels.'
    };
  }

  for (const catId of categoryIds) {
    const category = guild.channels.cache.get(catId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      continue;
    }
    const { canCreate } = checkCategoryCapacity(category);
    if (canCreate) {
      return { category, error: null };
    }
  }

  return {
    category: null,
    error: '❌ All wager categories are full (50 channels each).\n' +
      'Please ask a staff member to close old wager tickets.'
  };
}

/**
 * Generate channel name for 1v1 wager
 * @param {string} initiatorTag
 * @param {string} opponentTag
 * @returns {string}
 */
function generateChannelName(initiatorTag, opponentTag) {
  const name = `wager-${initiatorTag}-vs-${opponentTag}`;
  return name.replace(/\s+/g, '-').toLowerCase().slice(0, 90);
}

/**
 * Generate channel name for 2v2 wager
 * @param {string} initiatorTag
 * @param {string} teammateTag
 * @returns {string}
 */
function generate2v2ChannelName(initiatorTag, teammateTag) {
  const name = `2v2-wager-${initiatorTag}-${teammateTag}`;
  return name.replace(/\s+/g, '-').toLowerCase().slice(0, 90);
}

/**
 * Create permission overwrites for users (locked - no SendMessages until accept)
 * @param {import('discord.js').Guild} guild
 * @param {Set<string>|string[]} userIds
 * @param {string[]} roleIdsHosters
 * @returns {Promise<Object[]>}
 */
async function createPermissionOverwritesForUsers(
  guild,
  userIds,
  roleIdsHosters
) {
  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] }
  ];

  // Users can view but NOT send messages until wager is accepted
  for (const uid of userIds) {
    try {
      const member = await guild.members.fetch(uid);
      if (member) {
        overwrites.push({
          id: uid,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles
          ],
          deny: [PermissionFlagsBits.SendMessages]
        });
      }
    } catch (_) {}
  }

  // Hosters/mods can always send messages
  for (const rid of roleIdsHosters || []) {
    const role = guild.roles.cache.get(rid);
    if (role) {
      overwrites.push({
        id: rid,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.AttachFiles
        ]
      });
    }
  }

  return overwrites;
}

/**
 * Unlock chat for participants (grant SendMessages)
 * @param {import('discord.js').TextChannel} channel
 * @param {string[]} userIds - Array of user IDs to unlock
 */
async function unlockChannelForUsers(channel, userIds) {
  for (const uid of userIds) {
    try {
      await channel.permissionOverwrites.edit(uid, {
        SendMessages: true
      });
    } catch (_) {}
  }
}

/**
 * Create wager channel for 1v1
 * @param {import('discord.js').Guild} guild
 * @param {Object} category
 * @param {Object} initiator
 * @param {Object} opponent
 * @param {Set<string>} userIds
 * @param {string[]} roleIdsHosters
 * @returns {Promise<import('discord.js').TextChannel>}
 * @throws {CategoryFullError} If category has reached 50 channels
 */
async function createWagerChannel(
  guild,
  category,
  initiator,
  opponent,
  userIds,
  roleIdsHosters
) {
  // Check category capacity before creating
  const { canCreate, count } = checkCategoryCapacity(category);
  if (!canCreate) {
    throw new CategoryFullError(category.name, count);
  }

  const initiatorName = initiator.tag || initiator.username || initiator.id;
  const opponentName = opponent.tag || opponent.username || opponent.id;
  const name = generateChannelName(initiatorName, opponentName);
  const permissionOverwrites = await createPermissionOverwritesForUsers(
    guild,
    userIds,
    roleIdsHosters
  );

  try {
    return await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites,
      reason: `Wager channel: ${initiatorName} vs ${opponentName}`
    });
  } catch (err) {
    if (err.code === 30013) {
      throw new ServerChannelLimitError();
    }
    throw err;
  }
}

/**
 * Create wager channel for 2v2
 * @param {import('discord.js').Guild} guild
 * @param {Object} category
 * @param {Object} initiator
 * @param {Object} teammate
 * @param {Object} opponent1
 * @param {Object} opponent2
 * @param {Set<string>} userIds
 * @param {string[]} roleIdsHosters
 * @returns {Promise<import('discord.js').TextChannel>}
 * @throws {CategoryFullError} If category has reached 50 channels
 */
async function createWagerChannel2v2(
  guild,
  category,
  initiator,
  teammate,
  opponent1,
  opponent2,
  userIds,
  roleIdsHosters
) {
  // Check category capacity before creating
  const { canCreate, count } = checkCategoryCapacity(category);
  if (!canCreate) {
    throw new CategoryFullError(category.name, count);
  }

  const initiatorName = initiator.tag || initiator.username || initiator.id;
  const teammateName = teammate.tag || teammate.username || teammate.id;
  const name = generate2v2ChannelName(initiatorName, teammateName);
  const permissionOverwrites = await createPermissionOverwritesForUsers(
    guild,
    userIds,
    roleIdsHosters
  );

  const opp1Name = opponent1.tag || opponent1.username || opponent1.id;
  const opp2Name = opponent2.tag || opponent2.username || opponent2.id;

  try {
    return await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: category.id,
      permissionOverwrites,
      reason: `2v2 Wager: ${initiatorName} & ${teammateName} ` +
        `vs ${opp1Name} & ${opp2Name}`
    });
  } catch (err) {
    if (err.code === 30013) {
      throw new ServerChannelLimitError();
    }
    throw err;
  }
}

module.exports = {
  CategoryFullError,
  AllCategoriesFullError,
  ServerChannelLimitError,
  checkCategoryCapacity,
  findAvailableWagerCategory,
  createWagerChannel,
  createWagerChannel2v2,
  unlockChannelForUsers
};

