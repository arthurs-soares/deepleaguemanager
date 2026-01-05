const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { getUserGuildInfo } = require('../../../utils/guilds/userGuildInfo');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { safeDeferEphemeral } = require('../../../utils/core/ack');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { logRoleAssignment } = require('../../../utils/core/roleLogger');
const { sendDmOrFallback } = require('../../../utils/dm/dmFallback');
const LoggerService = require('../../../services/LoggerService');

/**
 * Button handler for accepting a co-leader invitation via DM
 * CustomId: coLeaderInvite:accept:<guildId>:<inviterId>
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

    const userId = interaction.user.id;

    // Pre-fetch guild to validate existence and check cross-guild membership
    const preGuildCheck = await Guild.findById(guildId).select('discordGuildId name');
    if (!preGuildCheck) {
      const embed = createErrorEmbed('Not found', 'Guild no longer exists.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Check cross-guild membership
    const { guild: existingGuild } = await getUserGuildInfo(
      preGuildCheck.discordGuildId,
      userId
    );

    if (existingGuild && String(existingGuild._id) !== String(guildId)) {
      const embed = createErrorEmbed(
        'Already in a guild',
        `You are already a member of "${existingGuild.name}". You must leave it first.`
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Step 1: Try to promote existing member if they exist and no co-leader exists
    // Condition: No member has role 'vice-lider' AND target user is in members array
    let updatedGuild = await Guild.findOneAndUpdate(
      {
        _id: guildId,
        'members.role': { $ne: 'vice-lider' },
        'members.userId': userId
      },
      {
        $set: { 'members.$.role': 'vice-lider' }
      },
      { new: true }
    );

    // Step 2: If not found (maybe user not in members), try to add as new member
    // Condition: No member has role 'vice-lider' AND target user is NOT in members array
    if (!updatedGuild) {
      updatedGuild = await Guild.findOneAndUpdate(
        {
          _id: guildId,
          'members.role': { $ne: 'vice-lider' },
          'members.userId': { $ne: userId }
        },
        {
          $push: {
            members: {
              userId,
              username: interaction.user.username,
              role: 'vice-lider',
              joinedAt: new Date()
            }
          }
        },
        { new: true }
      );
    }

    if (!updatedGuild) {
      // Diagnose why it failed
      const checkGuild = await Guild.findById(guildId);
      if (!checkGuild) {
        const embed = createErrorEmbed(
          'Guild not found',
          'This invitation refers to a guild that no longer exists.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }

      const members = checkGuild.members || [];
      const hasCoLeader = members.some(m => m.role === 'vice-lider');
      const isLeader = members.some(m => m.userId === userId && m.role === 'lider');
      const isAlreadyCo = members.some(m => m.userId === userId && m.role === 'vice-lider');

      if (isLeader) {
        const embed = createErrorEmbed(
          'Invalid',
          'The guild leader cannot become co-leader.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }

      if (isAlreadyCo) {
        const embed = createErrorEmbed(
          'Already co-leader',
          'You are already the co-leader of this guild.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }

      if (hasCoLeader) {
        const embed = createErrorEmbed(
          'Limit reached',
          'This guild already has a co-leader.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }

      // Fallback
      const embed = createErrorEmbed(
        'Error',
        'Could not accept invitation due to a state conflict. Please try again.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const guildDoc = updatedGuild;

    // Try to assign the co-leader role if configured
    await assignCoLeaderRole(interaction, guildDoc, userId, inviterId);

    // Disable buttons
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) { /* ignore */ }

    // Notify inviter
    await notifyInviterOnAccept(interaction, guildDoc, inviterId, userId);

    const embed = createSuccessEmbed(
      'You are now Co-Leader!',
      `Congratulations! You have been promoted to Co-Leader of ` +
      `"${guildDoc.name}".`
    );
    return interaction.editReply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in coLeaderInviteAccept:', { error });
    const embed = createErrorEmbed('Error', 'Could not accept invitation.');
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
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

/**
 * Assign Discord co-leader role if configured
 */
async function assignCoLeaderRole(interaction, guildDoc, userId, inviterId) {
  const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
  const coRoleId = cfg?.coLeadersRoleId;
  if (!coRoleId) return;

  try {
    const discordGuild = interaction.client.guilds.cache
      .get(guildDoc.discordGuildId);
    if (!discordGuild) return;

    const role = discordGuild.roles.cache.get(coRoleId);
    const member = await discordGuild.members.fetch(userId).catch(() => null);
    if (role && member && !member.roles.cache.has(coRoleId)) {
      await member.roles.add(coRoleId);
      await logRoleAssignment(
        discordGuild,
        userId,
        coRoleId,
        role.name,
        inviterId || 'system',
        'Co-leader role assigned via invitation acceptance'
      );
    }
  } catch (_) { /* ignore role assignment errors */ }
}

/**
 * Notify the inviter that co-leader invite was accepted
 */
async function notifyInviterOnAccept(interaction, guildDoc, inviterId, userId) {
  if (!inviterId || inviterId === 'unknown') return;

  try {
    const embed = createSuccessEmbed(
      'Co-Leader Invitation Accepted',
      `User <@${userId}> (${interaction.user.username}) accepted ` +
      `your invitation to become Co-Leader of "${guildDoc.name}".`
    );

    await sendDmOrFallback(
      interaction.client,
      guildDoc.discordGuildId,
      inviterId,
      { components: [embed], flags: MessageFlags.IsComponentsV2 },
      {
        threadTitle: `Co-Leader Invite Accepted — ${guildDoc.name}`,
        reason: `Notify inviter ${inviterId} about acceptance`
      }
    );
  } catch (_) { /* ignore notification errors */ }
}

module.exports = { handle };
