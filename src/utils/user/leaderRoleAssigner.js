const { getOrCreateRoleConfig } = require('../misc/roleConfig');
const { logRoleAssignment } = require('../core/roleLogger');
const LoggerService = require('../../services/LoggerService');

/**
 * Ensures that a user receives the Leader role when registered as such
 * - Tries to add the role and logs the assignment
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {string} userId - User ID to assign leader role to
 * @param {string} assignedBy - User ID who triggered this assignment (optional)
 */
async function ensureLeaderDiscordRole(guild, userId, assignedBy = 'system') {
  try {
    const cfg = await getOrCreateRoleConfig(guild.id);
    const leaderRoleId = cfg.leadersRoleId;
    if (!leaderRoleId) return;

    const role = guild.roles.cache.get(leaderRoleId);
    if (!role) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member) return;

    if (!member.roles.cache.has(leaderRoleId)) {
      await member.roles.add(leaderRoleId);

      // Log the role assignment
      await logRoleAssignment(
        guild,
        userId,
        leaderRoleId,
        role.name,
        assignedBy,
        'Automatic leader role assignment during guild registration'
      );
    }
  } catch (error) {
    LoggerService.error('Error assigning leader role:', { error: error?.message, userId });
  }
}

module.exports = { ensureLeaderDiscordRole };

