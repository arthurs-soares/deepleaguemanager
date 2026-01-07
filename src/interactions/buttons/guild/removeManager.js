const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { isGuildLeader } = require('../../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { logRoleRemoval } = require('../../../utils/core/roleLogger');

/**
 * Button handler for removing a manager
 * CustomId: manager:remove:<guildId>:<managerId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });

    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const managerId = parts[3];

    if (!guildId || !managerId) {
      const embed = createErrorEmbed('Invalid', 'Missing information.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    if (!admin && !isLeader) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the guild leader can remove managers.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const managers = Array.isArray(guildDoc.managers) ? guildDoc.managers : [];

    if (!managers.includes(managerId)) {
      const embed = createErrorEmbed(
        'Not a manager',
        'This user is not a manager of this guild.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Remove manager
    guildDoc.managers = managers.filter(id => id !== managerId);
    await guildDoc.save();

    // Try to remove the managers role if configured
    const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
    const managersRoleId = cfg?.managersRoleId;
    if (managersRoleId) {
      try {
        const discordGuild = interaction.client.guilds.cache
          .get(guildDoc.discordGuildId) || interaction.guild;
        if (discordGuild) {
          const role = discordGuild.roles.cache.get(managersRoleId);
          const targetMember = await discordGuild.members.fetch(managerId)
            .catch(() => null);
          if (role && targetMember && targetMember.roles.cache.has(managersRoleId)) {
            await targetMember.roles.remove(managersRoleId);
            await logRoleRemoval(
              discordGuild,
              managerId,
              managersRoleId,
              role.name,
              interaction.user.id,
              'Manager role removed by guild leader'
            );
          }
        }
      } catch (_) { /* ignore role removal errors */ }
    }

    const container = createSuccessEmbed(
      'Manager removed',
      `<@${managerId}> has been removed as a manager of this guild.`
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    const container = createErrorEmbed(
      'Error',
      'Could not remove the manager.'
    );
    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }
      return interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    } catch (_) { /* swallow reply errors */ }
  }
}

module.exports = { handle };
