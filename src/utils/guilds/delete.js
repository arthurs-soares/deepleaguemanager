const Guild = require('../../models/guild/Guild');
const LoggerService = require('../../services/LoggerService');
const { getOrCreateRoleConfig } = require('../misc/roleConfig');
const { logRoleRemoval } = require('../core/roleLogger');

/**
 * Remove leadership roles (leader, co-leader, manager) from guild members
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {object} guildDoc - Guild document with members and managers
 */
async function removeLeadershipRoles(discordGuild, guildDoc) {
  if (!discordGuild || !guildDoc) return;

  try {
    const cfg = await getOrCreateRoleConfig(discordGuild.id);
    const { leadersRoleId, coLeadersRoleId, managersRoleId } = cfg;

    const members = Array.isArray(guildDoc.members) ? guildDoc.members : [];
    const managers = Array.isArray(guildDoc.managers) ? guildDoc.managers : [];

    // Find leader and co-leader from members
    const leader = members.find(m => m?.role === 'lider');
    const coLeader = members.find(m => m?.role === 'vice-lider');

    // Remove leader role
    if (leadersRoleId && leader?.userId) {
      try {
        const role = discordGuild.roles.cache.get(leadersRoleId);
        const member = await discordGuild.members.fetch(leader.userId).catch(() => null);
        if (role && member && member.roles.cache.has(leadersRoleId)) {
          await member.roles.remove(leadersRoleId);
          await logRoleRemoval(
            discordGuild,
            leader.userId,
            leadersRoleId,
            role.name,
            'system',
            `Leader role removed - guild "${guildDoc.name}" deleted`
          );
        }
      } catch (err) {
        LoggerService.warn('Could not remove leader role during guild deletion', {
          guildName: guildDoc.name,
          userId: leader.userId,
          error: err?.message
        });
      }
    }

    // Remove co-leader role
    if (coLeadersRoleId && coLeader?.userId) {
      try {
        const role = discordGuild.roles.cache.get(coLeadersRoleId);
        const member = await discordGuild.members.fetch(coLeader.userId).catch(() => null);
        if (role && member && member.roles.cache.has(coLeadersRoleId)) {
          await member.roles.remove(coLeadersRoleId);
          await logRoleRemoval(
            discordGuild,
            coLeader.userId,
            coLeadersRoleId,
            role.name,
            'system',
            `Co-leader role removed - guild "${guildDoc.name}" deleted`
          );
        }
      } catch (err) {
        LoggerService.warn('Could not remove co-leader role during guild deletion', {
          guildName: guildDoc.name,
          userId: coLeader.userId,
          error: err?.message
        });
      }
    }

    // Remove manager roles
    if (managersRoleId && managers.length > 0) {
      const role = discordGuild.roles.cache.get(managersRoleId);
      for (const managerId of managers) {
        if (!managerId) continue;
        try {
          const member = await discordGuild.members.fetch(managerId).catch(() => null);
          if (role && member && member.roles.cache.has(managersRoleId)) {
            await member.roles.remove(managersRoleId);
            await logRoleRemoval(
              discordGuild,
              managerId,
              managersRoleId,
              role.name,
              'system',
              `Manager role removed - guild "${guildDoc.name}" deleted`
            );
          }
        } catch (err) {
          LoggerService.warn('Could not remove manager role during guild deletion', {
            guildName: guildDoc.name,
            userId: managerId,
            error: err?.message
          });
        }
      }
    }
  } catch (err) {
    LoggerService.warn('Error removing leadership roles during guild deletion', {
      guildName: guildDoc.name,
      error: err?.message
    });
  }
}

/**
 * Delete a guild and remove its roster thread from all forums
 * Also removes leadership roles (leader, co-leader, manager) from members
 * @param {string} guildId - MongoDB guild ID
 * @param {import('discord.js').Client} client - Discord client
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function deleteGuild(guildId, client) {
  // First fetch the guild to get member info before deleting
  const guildToDelete = await Guild.findById(guildId);
  if (!guildToDelete) return { success: false, message: 'Guild not found.' };

  const discordGuild = client?.guilds?.cache?.get?.(
    guildToDelete.discordGuildId
  ) || null;

  // Remove leadership roles before deleting the guild
  if (discordGuild) {
    await removeLeadershipRoles(discordGuild, guildToDelete);
  }

  // Now delete the guild
  const deletedGuild = await Guild.findByIdAndDelete(guildId);
  if (!deletedGuild) return { success: false, message: 'Guild not found.' };

  try {
    if (discordGuild) {
      const { removeGuildRosterThread } = require('../roster/rosterForumSync');
      await removeGuildRosterThread(discordGuild, deletedGuild.name);
    }
  } catch (err) {
    LoggerService.warn('Could not remove roster topic for deleted guild', {
      guildId,
      guildName: deletedGuild.name,
      error: err?.message
    });
  }
  return {
    success: true,
    message: `Guild "${deletedGuild.name}" deleted successfully!`
  };
}

module.exports = { deleteGuild };

