// Wager channel management utilities (mirrors war/channelManager with users)
const { ChannelType, PermissionFlagsBits } = require('discord.js');

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
 */
async function createWagerChannel(
  guild,
  category,
  initiator,
  opponent,
  userIds,
  roleIdsHosters
) {
  const initiatorName = initiator.tag || initiator.username || initiator.id;
  const opponentName = opponent.tag || opponent.username || opponent.id;
  const name = generateChannelName(initiatorName, opponentName);
  const permissionOverwrites = await createPermissionOverwritesForUsers(
    guild,
    userIds,
    roleIdsHosters
  );

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites,
    reason: `Wager channel: ${initiatorName} vs ${opponentName}`
  });
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

  return guild.channels.create({
    name,
    type: ChannelType.GuildText,
    parent: category.id,
    permissionOverwrites,
    reason: `2v2 Wager: ${initiatorName} & ${teammateName} vs ${opp1Name} & ${opp2Name}`
  });
}

module.exports = {
  createWagerChannel,
  createWagerChannel2v2,
  unlockChannelForUsers
};

