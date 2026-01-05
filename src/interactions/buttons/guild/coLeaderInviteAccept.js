const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { getUserGuildInfo } = require('../../../utils/guilds/userGuildInfo');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { safeDeferEphemeral } = require('../../../utils/core/ack');
const {
  handleCoLeaderRoleChange
} = require('../../../utils/guilds/inviteRoleHandler');
const { sendDmOrFallback } = require('../../../utils/dm/dmFallback');
const LoggerService = require('../../../services/LoggerService');

/** Validate guild for invite acceptance */
async function validateGuildForInvite(guildId, userId) {
  const preGuild = await Guild.findById(guildId).select('discordGuildId name');
  if (!preGuild) return { error: 'Guild no longer exists.' };

  const { guild: existingGuild } = await getUserGuildInfo(
    preGuild.discordGuildId, userId
  );
  if (existingGuild && String(existingGuild._id) !== String(guildId)) {
    return { error: `Already member of "${existingGuild.name}". Leave first.` };
  }
  return { guild: preGuild };
}

/** Diagnose why co-leader promotion failed */
function diagnoseUpdateFailure(checkGuild, userId) {
  if (!checkGuild) return 'Guild no longer exists.';

  const members = checkGuild.members || [];
  const hasCoLeader = members.some(m => m.role === 'vice-lider');
  const isLeader = members.some(m => m.userId === userId && m.role === 'lider');
  const isAlreadyCo = members.some(m => m.userId === userId && m.role === 'vice-lider');

  if (isLeader) return 'Guild leader cannot become co-leader.';
  if (isAlreadyCo) return 'You are already the co-leader.';
  if (hasCoLeader) return 'This guild already has a co-leader.';
  return 'State conflict. Please try again.';
}

/** Notify inviter that invite was accepted */
async function notifyInviterOnAccept(interaction, guildDoc, inviterId, userId) {
  if (!inviterId || inviterId === 'unknown') return;
  try {
    const embed = createSuccessEmbed(
      'Co-Leader Invite Accepted',
      `<@${userId}> accepted your invitation to Co-Leader of "${guildDoc.name}".`
    );
    await sendDmOrFallback(
      interaction.client, guildDoc.discordGuildId, inviterId,
      { components: [embed], flags: MessageFlags.IsComponentsV2 },
      { threadTitle: `Co-Leader Accepted — ${guildDoc.name}` }
    );
  } catch (_) { }
}

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
    const userId = interaction.user.id;

    if (!guildId) {
      const embed = createErrorEmbed('Invalid invitation', 'Missing guild info.');
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Validate guild and membership
    const { error: validateError } = await validateGuildForInvite(guildId, userId);
    if (validateError) {
      const embed = createErrorEmbed('Error', validateError);
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Try to promote existing member
    let updatedGuild = await Guild.findOneAndUpdate(
      { _id: guildId, 'members.role': { $ne: 'vice-lider' }, 'members.userId': userId },
      { $set: { 'members.$.role': 'vice-lider' } },
      { new: true }
    );

    // If not found, add as new member
    if (!updatedGuild) {
      updatedGuild = await Guild.findOneAndUpdate(
        { _id: guildId, 'members.role': { $ne: 'vice-lider' }, 'members.userId': { $ne: userId } },
        { $push: { members: { userId, username: interaction.user.username, role: 'vice-lider', joinedAt: new Date() } } },
        { new: true }
      );
    }

    if (!updatedGuild) {
      const checkGuild = await Guild.findById(guildId);
      const errorMsg = diagnoseUpdateFailure(checkGuild, userId);
      const embed = createErrorEmbed('Error', errorMsg);
      return interaction.editReply({
        components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Assign role and notify
    await handleCoLeaderRoleChange(interaction.client, updatedGuild, userId, null, inviterId);
    try { await interaction.message.edit({ components: [] }); } catch (_) { }
    await notifyInviterOnAccept(interaction, updatedGuild, inviterId, userId);

    const embed = createSuccessEmbed(
      'You are now Co-Leader!',
      `You are now Co-Leader of "${updatedGuild.name}".`
    );
    return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 });

  } catch (error) {
    LoggerService.error('Error in coLeaderInviteAccept:', { error });
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
