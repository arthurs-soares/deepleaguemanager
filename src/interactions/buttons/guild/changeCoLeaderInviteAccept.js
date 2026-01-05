const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { getUserGuildInfo } = require('../../../utils/guilds/userGuildInfo');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { safeDeferEphemeral } = require('../../../utils/core/ack');
const {
  handleCoLeaderRoleChange,
  notifyDemotedCoLeader
} = require('../../../utils/guilds/inviteRoleHandler');
const LoggerService = require('../../../services/LoggerService');

/** Validate and get guild for invite */
async function validateGuildForInvite(guildId, userId) {
  const preGuildCheck = await Guild.findById(guildId).select('discordGuildId name');
  if (!preGuildCheck) return { error: 'Guild no longer exists.' };

  const { guild: existingGuild } = await getUserGuildInfo(
    preGuildCheck.discordGuildId, userId
  );

  if (existingGuild && String(existingGuild._id) !== String(guildId)) {
    return { error: `Already member of "${existingGuild.name}". Leave first.` };
  }

  return { guild: preGuildCheck };
}

/** Diagnose why update failed and return error message */
function diagnoseUpdateFailure(checkGuild, userId, oldCoLeaderId) {
  if (!checkGuild) return 'Guild no longer exists.';

  const members = checkGuild.members || [];
  const currentCo = members.find(m => m.role === 'vice-lider');

  if (members.some(m => m.userId === userId && m.role === 'vice-lider')) {
    return 'You are already the co-leader.';
  }

  if (currentCo && oldCoLeaderId && currentCo.userId !== oldCoLeaderId) {
    return 'The co-leader position changed since this invite.';
  }

  if (currentCo && !oldCoLeaderId) {
    return 'A co-leader was appointed before you accepted.';
  }

  return 'Could not accept due to a state conflict.';
}

/** Try to promote existing member to co-leader */
async function promoteExistingMember(baseQuery, userId) {
  return Guild.findOneAndUpdate(
    { ...baseQuery, 'members.userId': userId },
    { $set: { 'members.$[old].role': 'membro', 'members.$[target].role': 'vice-lider' } },
    {
      new: true,
      arrayFilters: [
        { 'old.role': 'vice-lider', 'old.userId': { $ne: userId } },
        { 'target.userId': userId }
      ]
    }
  );
}

/** Add new member as co-leader (2-step process) */
async function addNewMemberAsCoLeader(baseQuery, guildId, userId, username) {
  // Step 1: Demote existing co-leader
  await Guild.updateOne(
    { ...baseQuery, 'members.userId': { $ne: userId } },
    { $set: { 'members.$[old].role': 'membro' } },
    { arrayFilters: [{ 'old.role': 'vice-lider' }] }
  );

  // Step 2: Add new user as co-leader
  return Guild.findOneAndUpdate(
    {
      _id: guildId,
      'members.userId': { $ne: userId },
      'members': { $not: { $elemMatch: { role: 'vice-lider' } } }
    },
    { $push: { members: { userId, username, role: 'vice-lider', joinedAt: new Date() } } },
    { new: true }
  );
}

/**
 * Button handler for accepting a co-leader REPLACEMENT invitation via DM
 * CustomId: changeCoLeaderInvite:accept:<guildId>:<inviterId>:<oldCoLeaderId>
 */
async function handle(interaction) {
  try {
    await safeDeferEphemeral(interaction);

    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const inviterId = parts[3] || null;
    const oldCoLeaderId = parts[4] || null;
    const userId = interaction.user.id;

    if (!guildId) {
      const embed = createErrorEmbed('Invalid invitation', 'Missing guild info.');
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Validate guild and membership
    const { error: validateError } = await validateGuildForInvite(
      guildId, userId
    );
    if (validateError) {
      const embed = createErrorEmbed('Error', validateError);
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Build safety condition query
    const safetyCondition = [
      { 'members': { $not: { $elemMatch: { role: 'vice-lider' } } } }
    ];
    if (oldCoLeaderId) {
      safetyCondition.push({
        'members': { $elemMatch: { role: 'vice-lider', userId: oldCoLeaderId } }
      });
    }
    const baseQuery = { _id: guildId, $or: safetyCondition };

    // Try to promote existing member first
    let updatedGuild = await promoteExistingMember(baseQuery, userId);

    // If not found, add as new member
    if (!updatedGuild) {
      updatedGuild = await addNewMemberAsCoLeader(
        baseQuery, guildId, userId, interaction.user.username
      );
    }

    if (!updatedGuild) {
      const checkGuild = await Guild.findById(guildId);
      const errorMsg = diagnoseUpdateFailure(checkGuild, userId, oldCoLeaderId);
      const embed = createErrorEmbed('Error', errorMsg);
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Handle roles and notifications
    await handleCoLeaderRoleChange(
      interaction.client, updatedGuild, userId, oldCoLeaderId, inviterId
    );
    await notifyDemotedCoLeader(interaction.client, updatedGuild, oldCoLeaderId);

    try { await interaction.message.edit({ components: [] }); } catch (_) { }

    const embed = createSuccessEmbed(
      'You are now Co-Leader!',
      `You are now Co-Leader of "${updatedGuild.name}".`
    );
    return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 });

  } catch (error) {
    LoggerService.error('Error in changeCoLeaderInviteAccept:', { error });
    const embed = createErrorEmbed('Error', 'Could not accept invitation.');
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
