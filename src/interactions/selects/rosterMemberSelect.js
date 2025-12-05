const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../utils/embeds/embedBuilder');
const {
  removeFromRoster,
  getGuildById,
  getRegionRosters
} = require('../../utils/roster/rosterManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const {
  isGuildLeader,
  canManageUser
} = require('../../utils/guilds/guildMemberManager');
const { auditAdminAction } = require('../../utils/misc/adminAudit');
const {
  recordGuildLeave
} = require('../../utils/rate-limiting/guildTransitionCooldown');

async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    const action = parts[2];
    const source = parts[3];
    // Decode region (underscores back to spaces)
    const region = parts[4]?.replace(/_/g, ' ');

    if (!guildId || !action || !region) {
      const embed = createErrorEmbed('Invalid', 'Missing data.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const targetUserId = interaction.values?.[0];
    if (!targetUserId) return interaction.deferUpdate();

    if (!['remove_main', 'remove_sub'].includes(action)) {
      return interaction.deferUpdate();
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const isAdmin = source === 'admin';
    if (!isAdmin) {
      const canManage = canManageUser(guildDoc, interaction.user.id, targetUserId);
      if (!canManage) {
        const embed = createErrorEmbed(
          'Permission denied',
          'You can only remove members with lower role.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2
        });
      }
    }

    const roster = action === 'remove_main' ? 'main' : 'sub';
    const { mainRoster, subRoster } = getRegionRosters(guildDoc, region);
    const rosterMembers = roster === 'main' ? mainRoster : subRoster;

    if (!rosterMembers.includes(targetUserId)) {
      const embed = createErrorEmbed(
        'Not in roster',
        'User is not in this roster for ' + region + '.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const result = await removeFromRoster(guildId, roster, targetUserId, region);
    if (!result.success) {
      const embed = createErrorEmbed('Error', result.message || 'Failed.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    try {
      await recordGuildLeave(
        interaction.guild.id,
        targetUserId,
        guildId,
        new Date()
      );
    } catch (e) {}

    if (roster === 'main') {
      try {
        const members = guildDoc.members || [];
        const co = members.find(
          m => m.userId === targetUserId && m.role === 'vice-lider'
        );
        if (co) {
          co.role = 'membro';
          await guildDoc.save();
        }
      } catch (e) {}
    }

    const memberSelf = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(memberSelf, interaction.guild.id);
    const leader = isGuildLeader(guildDoc, interaction.user.id);
    if (admin && !leader) {
      try {
        await auditAdminAction(interaction.guild, interaction.user.id, 'Edit Roster', {
          guildName: guildDoc?.name,
          guildId,
          targetUserId,
          extra: 'Action: ' + action + ', Region: ' + region,
        });
      } catch (e) {}
    }

    const rosterName = roster === 'main' ? 'Main Roster' : 'Sub Roster';
    const embed = createSuccessEmbed(
      'Removed',
      '<@' + targetUserId + '> removed from ' + rosterName + ' for ' + region + '.'
    );
    return interaction.editReply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    console.error('Error in roster member select:', error);
    const embed = createErrorEmbed('Error', 'Could not process removal.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
