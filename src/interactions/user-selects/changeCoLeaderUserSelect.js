const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');
const { createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds/embedBuilder');
const Guild = require('../../models/guild/Guild');
const { isGuildLeader } = require('../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../utils/core/permissions');

/**
 * User Select handler to change co-leader
 * CustomId: change_co_leader_user_select:<guildId>
 */
async function handle(interaction) {
  try {
    const [, guildId] = interaction.customId.split(':');
    const userId = interaction.values?.[0];
    if (!guildId || !userId) return interaction.deferUpdate();

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    if (!admin && !isGuildLeader(guildDoc, interaction.user.id)) {
      const embed = createErrorEmbed('Permission denied', 'Only the guild leader or a server administrator can change the co-leader.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const members = Array.isArray(guildDoc.members) ? [...guildDoc.members] : [];

    // Find current co-leader
    const currentCoLeader = members.find(m => m.role === 'vice-lider');
    if (!currentCoLeader) {
      const embed = createErrorEmbed('No co-leader', 'This guild does not have a co-leader to change.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Check if selected user is the same as current co-leader
    if (currentCoLeader.userId === userId) {
      const embed = createErrorEmbed('Same user', 'The selected user is already the co-leader.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Check if selected user is the guild leader
    if (isGuildLeader(guildDoc, userId)) {
      const embed = createErrorEmbed(
        'Invalid selection',
        'The guild leader cannot be selected as co-leader.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Add as member if not already in members array (no roster requirement)
    const existing = members.find(m => m.userId === userId);
    if (!existing) {
      let username = userId;
      try {
        const user = await interaction.client.users.fetch(userId);
        username = user?.username || username;
      } catch (_) { }
      const newMember = {
        userId,
        username,
        role: 'membro',
        joinedAt: new Date()
      };
      guildDoc.members = [...members, newMember];
    }

    // Demote current co-leader to member
    currentCoLeader.role = 'membro';

    // Promote new user to co-leader
    const target = (guildDoc.members || []).find(m => m.userId === userId);
    if (!target) {
      const embed = createErrorEmbed('Failure', 'Could not locate the member after adding.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    target.role = 'vice-lider';

    await guildDoc.save();

    // Handle Discord role changes
    const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
    const cfg = await getOrCreateRoleConfig(interaction.guild.id);
    const coRoleId = cfg?.coLeadersRoleId;

    if (coRoleId) {
      try {
        const role = interaction.guild.roles.cache.get(coRoleId);
        if (role) {
          // Remove role from old co-leader
          try {
            const oldMember = await interaction.guild.members.fetch(currentCoLeader.userId);
            if (oldMember && oldMember.roles.cache.has(coRoleId)) {
              await oldMember.roles.remove(coRoleId).catch(() => { });
            }
          } catch (_) { }

          // Add role to new co-leader
          try {
            const newMember = await interaction.guild.members.fetch(userId);
            if (newMember && !newMember.roles.cache.has(coRoleId)) {
              await newMember.roles.add(coRoleId).catch(() => { });
            }
          } catch (_) { }
        }
      } catch (_) { }
    }

    // Send notifications
    await sendChangeNotifications(interaction, guildDoc, currentCoLeader.userId, userId);

    // Audit log if admin (not leader) changed co-leader
    const memberSelf = await interaction.guild.members.fetch(interaction.user.id);
    const adminAudit = await isGuildAdmin(memberSelf, interaction.guild.id);
    const leader = isGuildLeader(guildDoc, interaction.user.id);
    if (adminAudit && !leader) {
      try {
        const { auditAdminAction } = require('../../utils/misc/adminAudit');
        await auditAdminAction(interaction.guild, interaction.user.id, 'Change Co-leader', {
          guildName: guildDoc.name,
          guildId,
          oldCoLeaderId: currentCoLeader.userId,
          newCoLeaderId: userId,
        });
      } catch (_) { }
    }

    const embed = createSuccessEmbed('Co-leader changed', `Co-leader successfully changed. <@${currentCoLeader.userId}> → <@${userId}>`);
    return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error changing co-leader:', { error: error?.message });
    const embed = createErrorEmbed('Error', 'Could not complete co-leader change.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
}

/**
 * Send notifications to old and new co-leaders
 */
async function sendChangeNotifications(interaction, guildDoc, oldCoLeaderId, newCoLeaderId) {
  try {
    const { sendDmOrFallback } = require('../../utils/dm/dmFallback');

    // Notify old co-leader
    try {
      const oldEmbed = createErrorEmbed(
        'Co-leadership removed',
        `You are no longer co-leader of guild **${guildDoc.name}**.`
      );
      await sendDmOrFallback(
        interaction.client,
        interaction.guild.id,
        oldCoLeaderId,
        { embeds: [oldEmbed] },
        { threadTitle: `Role Change — ${guildDoc.name}` }
      );
    } catch (_) { }

    // Notify new co-leader
    try {
      const newEmbed = createSuccessEmbed(
        'Promoted to Co-leader',
        `You have been promoted to co-leader of guild **${guildDoc.name}**!`
      );
      await sendDmOrFallback(
        interaction.client,
        interaction.guild.id,
        newCoLeaderId,
        { embeds: [newEmbed] },
        { threadTitle: `Role Change — ${guildDoc.name}` }
      );
    } catch (_) { }
  } catch (error) {
    LoggerService.error('Error sending change notifications:', { error: error?.message });
  }
}

module.exports = { handle };
