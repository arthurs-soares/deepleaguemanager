const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { createErrorEmbed, createSuccessEmbed } = require('../../../utils/embeds/embedBuilder');
const { isGuildLeader } = require('../../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../../utils/core/permissions');

/**
 * Handle confirmation to remove co-leader who is not on current rosters
 * CustomId: coLeader:removeConfirm:<guildId>:<userId>:yes|no
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    // [ 'coLeader', 'removeConfirm', guildId, userId, decision ]
    const guildId = parts[2];
    const userId = parts[3];
    const decision = parts[4];

    if (!guildId || !userId || !decision) {
      const embed = createErrorEmbed('Invalid data', 'Missing confirmation data.');
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    if (decision === 'no') {
      // Simply clear buttons and acknowledge
      try { return await interaction.update({ content: 'Action cancelled.', components: [] }); } catch (_) {}
      return;
    }

    // decision === 'yes'
    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Guild not found', 'Could not find the guild in the database.');
      if (interaction.deferred || interaction.replied) return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Permission check: server admin or guild leader
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isServerAdmin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);

    if (!isServerAdmin && !isLeader) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the guild leader or server admin can remove co-leaders.'
      );
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const members = Array.isArray(guildDoc.members) ? guildDoc.members : [];
    const co = members.find(m => m.userId === userId && m.role === 'vice-lider');
    if (!co) {
      const embed = createErrorEmbed('No co-leader', 'The selected user is not currently recorded as co-leader.');
      if (interaction.deferred || interaction.replied) return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Ensure not on current rosters; if so, require standard removal flow
    const inMain = (guildDoc.mainRoster || []).includes(userId);
    const inSub = (guildDoc.subRoster || []).includes(userId);
    if (inMain || inSub) {
      const embed = createErrorEmbed('Co-leader is in roster', 'Use Remove Main/Sub roster actions instead.');
      if (interaction.deferred || interaction.replied) return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Demote to regular member
    co.role = 'membro';
    await guildDoc.save();

    // Try to remove Discord co-leader role if configured and if the user is still in the server
    try {
      const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
      const cfg = await getOrCreateRoleConfig(interaction.guild.id);
      const coRoleId = cfg?.coLeadersRoleId;
      if (coRoleId) {
        try {
          const m = await interaction.guild.members.fetch(userId).catch(() => null);
          if (m && m.roles?.cache?.has(coRoleId)) {
            await m.roles.remove(coRoleId).catch(() => {});
          }
        } catch (_) { /* ignore */ }
      }
    } catch (_) { /* ignore */ }

    const embed = createSuccessEmbed('Co-leader removed', 'The co-leader was demoted successfully.');
    try {
      return await interaction.update({ components: [embed], flags: MessageFlags.IsComponentsV2 });
    } catch (_) {
      // Fallback if update fails
      if (interaction.deferred || interaction.replied) return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
  } catch (error) {
    console.error('Error in coLeaderRemoveConfirm:', error);
    const embed = createErrorEmbed('Error', 'Could not complete the co-leader removal.');
    try {
      if (interaction.deferred || interaction.replied) return await interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      return await interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (_) { /* ignore */ }
  }
}

module.exports = { handle };

