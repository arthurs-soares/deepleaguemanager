const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { safeDeferEphemeral } = require('../../../utils/core/ack');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { logRoleAssignment } = require('../../../utils/core/roleLogger');
const { sendDmOrFallback } = require('../../../utils/dm/dmFallback');

/**
 * Button handler for accepting a manager invitation via DM
 * CustomId: managerInvite:accept:<guildId>:<inviterId>
 */
async function handle(interaction) {
  try {
    await safeDeferEphemeral(interaction);

    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const inviterId = parts[3] || null;

    if (!guildId) {
      const embed = createErrorEmbed(
        'Invalid invitation',
        'Missing guild information.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed(
        'Guild not found',
        'This invitation refers to a guild that no longer exists.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const userId = interaction.user.id;
    const managers = Array.isArray(guildDoc.managers) ? guildDoc.managers : [];

    // Check if already a manager
    if (managers.includes(userId)) {
      const embed = createErrorEmbed(
        'Already a manager',
        'You are already a manager of this guild.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Check manager limit
    if (managers.length >= 2) {
      const embed = createErrorEmbed(
        'Limit reached',
        'This guild already has the maximum number of managers (2).'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Add as manager
    guildDoc.managers = [...managers, userId];
    await guildDoc.save();

    // Try to assign the managers role if configured
    const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
    const managersRoleId = cfg?.managersRoleId;
    if (managersRoleId) {
      try {
        const discordGuild = interaction.client.guilds.cache
          .get(guildDoc.discordGuildId);
        if (discordGuild) {
          const role = discordGuild.roles.cache.get(managersRoleId);
          const member = await discordGuild.members.fetch(userId)
            .catch(() => null);
          if (role && member && !member.roles.cache.has(managersRoleId)) {
            await member.roles.add(managersRoleId);
            await logRoleAssignment(
              discordGuild,
              userId,
              managersRoleId,
              role.name,
              inviterId || 'system',
              'Manager role assigned via invitation acceptance'
            );
          }
        }
      } catch (_) { /* ignore role assignment errors */ }
    }

    // Disable buttons after success
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) { /* ignore */ }

    const container = createSuccessEmbed(
      'You are now a manager',
      `You have been added as a manager of "${guildDoc.name}". ` +
      'You can now access the guild panel using `/guild panel`.'
    );

    // Notify inviter with DM fallback support
    if (inviterId) {
      try {
        const notifyEmbed = createSuccessEmbed(
          'Manager invitation accepted',
          `**${interaction.user.username}** accepted your manager ` +
          `invitation for guild "${guildDoc.name}".`
        );
        const dmPayload = {
          components: [notifyEmbed],
          flags: MessageFlags.IsComponentsV2
        };
        await sendDmOrFallback(
          interaction.client,
          guildDoc.discordGuildId,
          inviterId,
          dmPayload,
          {
            threadTitle: `Manager Accepted — ${guildDoc.name}`,
            reason: `Notify inviter ${inviterId} about manager acceptance`
          }
        );
      } catch (_) { /* ignore notification errors */ }
    }

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    const container = createErrorEmbed(
      'Error',
      'An error occurred while processing your acceptance.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
