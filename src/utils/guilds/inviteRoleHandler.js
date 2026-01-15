const { getOrCreateRoleConfig } = require('../misc/roleConfig');
const { logRoleAssignment } = require('../core/roleLogger');
const { sendDmOrFallback } = require('../dm/dmFallback');
const { createErrorEmbed } = require('../embeds/embedBuilder');

/**
 * Handle Discord role assignment for co-leader changes
 * @param {import('discord.js').Client} client - Discord client
 * @param {object} guildDoc - Guild document
 * @param {string} newUserId - New co-leader user ID
 * @param {string|null} oldUserId - Previous co-leader ID to demote
 * @param {string|null} inviterId - Who sent the invite
 */
async function handleCoLeaderRoleChange(
  client,
  guildDoc,
  newUserId,
  oldUserId,
  inviterId
) {
  const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
  const coRoleId = cfg?.coLeadersRoleId;
  if (!coRoleId) return;

  try {
    const discordGuild = client.guilds.cache.get(guildDoc.discordGuildId);
    if (!discordGuild) return;

    const role = discordGuild.roles.cache.get(coRoleId);
    if (!role) return;

    // Remove from old co-leader
    if (oldUserId) {
      const oldMem = await discordGuild.members
        .fetch(oldUserId)
        .catch(() => null);
      if (oldMem) await oldMem.roles.remove(coRoleId).catch(() => { });
    }

    // Add to new co-leader
    const newMem = await discordGuild.members
      .fetch(newUserId)
      .catch(() => null);
    if (newMem && !newMem.roles.cache.has(coRoleId)) {
      await newMem.roles.add(coRoleId);
      await logRoleAssignment(
        discordGuild,
        newUserId,
        coRoleId,
        role.name,
        inviterId || 'system',
        'Co-leader via Invite'
      );
    }
  } catch (_) { /* ignore role errors */ }
}

/**
 * Handle Discord role assignment for leader changes
 * @param {import('discord.js').Client} client - Discord client
 * @param {object} guildDoc - Guild document
 * @param {string} newUserId - New leader user ID
 * @param {string|null} oldUserId - Previous leader ID to demote
 * @param {string|null} inviterId - Who sent the invite
 */
async function handleLeaderRoleChange(
  client,
  guildDoc,
  newUserId,
  oldUserId,
  inviterId
) {
  const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
  const leaderRoleId = cfg?.leaderRoleId;
  if (!leaderRoleId) return;

  try {
    const discordGuild = client.guilds.cache.get(guildDoc.discordGuildId);
    if (!discordGuild) return;

    const role = discordGuild.roles.cache.get(leaderRoleId);
    if (!role) return;

    // Remove from old leader
    if (oldUserId && oldUserId !== newUserId) {
      const oldMem = await discordGuild.members
        .fetch(oldUserId)
        .catch(() => null);
      if (oldMem && oldMem.roles.cache.has(leaderRoleId)) {
        await oldMem.roles.remove(leaderRoleId).catch(() => { });
      }
    }

    // Add to new leader
    const newMem = await discordGuild.members
      .fetch(newUserId)
      .catch(() => null);
    if (newMem && !newMem.roles.cache.has(leaderRoleId)) {
      await newMem.roles.add(leaderRoleId);
      await logRoleAssignment(
        discordGuild,
        newUserId,
        leaderRoleId,
        role.name,
        inviterId || 'system',
        'Leader via Transfer'
      );
    }
  } catch (_) { /* ignore role errors */ }
}

/**
 * Handle Discord role assignment for manager additions
 * @param {import('discord.js').Client} client - Discord client
 * @param {object} guildDoc - Guild document
 * @param {string} newUserId - New manager user ID
 * @param {string|null} inviterId - Who sent the invite
 */
async function handleManagerRoleChange(client, guildDoc, newUserId, inviterId) {
  const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
  const mgrRoleId = cfg?.managersRoleId;
  if (!mgrRoleId) return;

  try {
    const discordGuild = client.guilds.cache.get(guildDoc.discordGuildId);
    if (!discordGuild) return;

    const role = discordGuild.roles.cache.get(mgrRoleId);
    if (!role) return;

    const member = await discordGuild.members.fetch(newUserId).catch(() => null);
    if (member && !member.roles.cache.has(mgrRoleId)) {
      await member.roles.add(mgrRoleId);
      await logRoleAssignment(
        discordGuild,
        newUserId,
        mgrRoleId,
        role.name,
        inviterId || 'system',
        'Manager via Invite'
      );
    }
  } catch (_) { /* ignore role errors */ }
}

/**
 * Notify demoted co-leader
 * @param {import('discord.js').Client} client - Discord client
 * @param {object} guildDoc - Guild document
 * @param {string} oldUserId - Demoted user ID
 */
async function notifyDemotedCoLeader(client, guildDoc, oldUserId) {
  if (!oldUserId) return;
  try {
    const embed = createErrorEmbed(
      'Co-leadership removed',
      `You are no longer co-leader of guild **${guildDoc.name}**.`
    );
    await sendDmOrFallback(
      client,
      guildDoc.discordGuildId,
      oldUserId,
      { embeds: [embed] },
      { threadTitle: `Role Change — ${guildDoc.name}` }
    );
  } catch (_) { /* ignore DM errors */ }
}

/**
 * Handle Discord role removal for managers
 * @param {import('discord.js').Client} client - Discord client
 * @param {string} discordGuildId - Discord server ID
 * @param {string} userId - User to remove role from
 * @param {string|null} removedBy - Who removed the manager (user ID or 'system')
 * @param {string} reason - Reason for removal
 */
async function handleManagerRoleRemoval(client, discordGuildId, userId, removedBy, reason) {
  const cfg = await getOrCreateRoleConfig(discordGuildId);
  const mgrRoleId = cfg?.managersRoleId;
  if (!mgrRoleId) return;

  try {
    const discordGuild = client.guilds.cache.get(discordGuildId);
    if (!discordGuild) return;

    const role = discordGuild.roles.cache.get(mgrRoleId);
    if (!role) return;

    const member = await discordGuild.members.fetch(userId).catch(() => null);
    if (member && member.roles.cache.has(mgrRoleId)) {
      await member.roles.remove(mgrRoleId);
      const { logRoleRemoval } = require('../core/roleLogger');
      await logRoleRemoval(
        discordGuild,
        userId,
        mgrRoleId,
        role.name,
        removedBy || 'system',
        reason || 'Manager role removed'
      );
    }
  } catch (_) { /* ignore role errors */ }
}

module.exports = {
  handleCoLeaderRoleChange,
  handleLeaderRoleChange,
  handleManagerRoleChange,
  handleManagerRoleRemoval,
  notifyDemotedCoLeader
};

