const { Events } = require('discord.js');
const Guild = require('../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../utils/misc/roleConfig');
const { logRoleRemoval } = require('../utils/core/roleLogger');
const LoggerService = require('../services/LoggerService');

module.exports = {
  name: Events.GuildMemberRemove,
  once: false,

  /**
     * Execute when a member leaves the server
     * Removes manager role and updates guild manager list if they were a manager
     * @param {import('discord.js').GuildMember} member - The member who left
     */
  async execute(member) {
    try {
      const userId = member.id;
      const discordGuildId = member.guild.id;

      // Find all guilds in this Discord server where this user is a manager
      const guildsWithManager = await Guild.find({
        discordGuildId,
        managers: userId
      });

      if (guildsWithManager.length === 0) {
        return; // User was not a manager in any guild
      }

      // Get role configuration
      const cfg = await getOrCreateRoleConfig(discordGuildId);
      const managersRoleId = cfg?.managersRoleId;

      // Remove user from managers list in all guilds they were managing
      for (const guildDoc of guildsWithManager) {
        try {
          guildDoc.managers = guildDoc.managers.filter(id => id !== userId);
          await guildDoc.save();

          LoggerService.info(`Manager removed from guild on member leave:`, {
            userId,
            guildName: guildDoc.name,
            discordGuildId
          });
        } catch (saveErr) {
          LoggerService.error('Failed to remove manager on member leave:', {
            error: saveErr?.message,
            userId,
            guildId: guildDoc._id
          });
        }
      }

      // Log role removal (role was automatically removed when member left)
      if (managersRoleId && member.roles.cache.has(managersRoleId)) {
        try {
          await logRoleRemoval(
            member.guild,
            userId,
            managersRoleId,
            member.guild.roles.cache.get(managersRoleId)?.name || 'Manager',
            'system',
            'Manager left the server'
          );
        } catch (_) { /* ignore log errors */ }
      }
    } catch (error) {
      LoggerService.error('Error in guildMemberRemove event:', {
        error: error?.message,
        userId: member?.id
      });
    }
  }
};
