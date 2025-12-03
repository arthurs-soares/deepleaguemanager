const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { isGuildLeader } = require('../../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const LoggerService = require('../../../services/LoggerService');

/**
 * Assign Discord co-leader role if configured
 * @param {object} interaction - Button interaction
 * @param {string} userId - Target user ID
 */
async function assignCoLeaderRole(interaction, userId) {
  const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
  const { logRoleAssignment } = require('../../../utils/core/roleLogger');
  const cfg = await getOrCreateRoleConfig(interaction.guild.id);
  const coRoleId = cfg?.coLeadersRoleId;

  if (!coRoleId) return;

  const role = interaction.guild.roles.cache.get(coRoleId);
  const targetMember = await interaction.guild.members.fetch(userId);
  if (role && targetMember && !targetMember.roles.cache.has(coRoleId)) {
    await targetMember.roles.add(coRoleId);
    await logRoleAssignment(
      interaction.guild,
      userId,
      coRoleId,
      role.name,
      interaction.user.id,
      'Co-leader role assigned via confirmation'
    );
  }
}

/**
 * Log admin audit if admin (not leader) performed action
 * @param {object} interaction - Button interaction
 * @param {object} guildDoc - Guild document
 * @param {string} guildId - Guild ID
 * @param {string} userId - Target user ID
 */
async function logAdminAudit(interaction, guildDoc, guildId, userId) {
  const memberSelf = await interaction.guild.members.fetch(interaction.user.id);
  const adminAudit = await isGuildAdmin(memberSelf, interaction.guild.id);
  const leader = isGuildLeader(guildDoc, interaction.user.id);

  if (adminAudit && !leader) {
    const { auditAdminAction } = require('../../../utils/misc/adminAudit');
    await auditAdminAction(
      interaction.guild,
      interaction.user.id,
      'Add Co-leader',
      { guildName: guildDoc.name, guildId, targetUserId: userId }
    );
  }
}

/**
 * Handle co-leader add confirmation
 * CustomId: coLeader:addConfirm:<guildId>:<userId>:yes|no
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const userId = parts[3];
    const decision = parts[4];

    if (!guildId || !userId || !decision) {
      const embed = createErrorEmbed('Invalid data', 'Missing confirmation.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    if (decision === 'no') {
      return interaction.update({ content: 'Action cancelled.', components: [] })
        .catch(() => {});
    }

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Guild not found', 'Guild not in DB.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);

    if (!admin && !isLeader) {
      const embed = createErrorEmbed('Permission denied', 'Not authorized.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    if (isGuildLeader(guildDoc, userId)) {
      const embed = createErrorEmbed('Invalid', 'Leader cannot be co-leader.');
      return interaction.update({ components: [embed] });
    }

    const members = Array.isArray(guildDoc.members) ? [...guildDoc.members] : [];
    const existing = members.find(m => m.userId === userId);

    if (existing?.role === 'vice-lider') {
      const embed = createErrorEmbed('Already co-leader', 'User is co-leader.');
      return interaction.update({ components: [embed] });
    }

    if (!existing) {
      let username = userId;
      try {
        const user = await interaction.client.users.fetch(userId);
        username = user?.username || username;
      } catch (_) { /* ignore */ }
      guildDoc.members = [...members, {
        userId, username, role: 'membro', joinedAt: new Date()
      }];
    }

    const coCount = (guildDoc.members || [])
      .filter(m => m.role === 'vice-lider').length;

    if (coCount >= 1) {
      const embed = createErrorEmbed('Limit reached', 'Max co-leaders (1).');
      return interaction.update({ components: [embed] });
    }

    const target = (guildDoc.members || []).find(m => m.userId === userId);
    if (!target) {
      const embed = createErrorEmbed('Failure', 'Member not found.');
      return interaction.update({ components: [embed] });
    }

    target.role = 'vice-lider';
    await guildDoc.save();

    try {
      await assignCoLeaderRole(interaction, userId);
    } catch (error) {
      LoggerService.error('Error assigning co-leader role:', { error });
    }

    try {
      await logAdminAudit(interaction, guildDoc, guildId, userId);
    } catch (_) { /* ignore */ }

    const embed = createSuccessEmbed(
      'Co-leader added',
      `User <@${userId}> promoted to co-leader.`
    );
    return interaction.update({ components: [embed] });
  } catch (error) {
    LoggerService.error('Error in coLeaderAddConfirm:', { error });
    const embed = createErrorEmbed('Error', 'Could not promote co-leader.');
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
