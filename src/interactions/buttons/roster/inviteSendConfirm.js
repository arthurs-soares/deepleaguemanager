const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { safeDeferUpdate, safeUpdate } = require('../../../utils/core/ack');
const { replyEphemeral } = require('../../../utils/core/reply');
const { getGuildById } = require('../../../utils/roster/rosterManager');
const { sendRosterInvite } = require('../../../utils/roster/sendRosterInvite');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../../utils/guilds/guildMemberManager');
const { handleKnownDiscordError } = require('../../../utils/core/discordErrorUtils');
const LoggerService = require('../../../services/LoggerService');

/** Max age (ms) before interaction is skipped */
const MAX_AGE_MS = 2500;

/**
 * Handle roster invite send confirmation
 * CustomId: rosterInvite:sendConfirm:<guildId>:<roster>:<userId>:yes|no:<region>
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('rosterInviteSendConfirm skipped (expired)', { age });
      return;
    }

    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const roster = parts[3];
    const userId = parts[4];
    const decision = parts[5];
    // Decode region (underscores back to spaces)
    const region = parts[6]?.replace(/_/g, ' ');

    if (!guildId || !roster || !userId || !decision || !region) {
      const embed = createErrorEmbed('Invalid data', 'Missing confirmation.');
      await replyEphemeral(interaction, { components: [embed] });
      return;
    }

    if (decision === 'no') {
      const embed = createSuccessEmbed('Cancelled', 'Invitation was cancelled.');
      await safeUpdate(interaction, {
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
      return;
    }

    // Acknowledge immediately to avoid 3s timeout (10062) on slower DB calls.
    // After this, use editReply / followUp instead of reply / update.
    await safeDeferUpdate(interaction);

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not in database.');
      await replyEphemeral(interaction, { components: [embed] });
      return;
    }

    // Permission check: server admin, leader, co-leader, or manager
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isServerAdmin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    const isCoLeader = isGuildCoLeader(guildDoc, interaction.user.id);
    const isMgr = isGuildManager(guildDoc, interaction.user.id);

    if (!isServerAdmin && !isLeader && !isCoLeader && !isMgr) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only guild leaders, co-leaders, managers, or server admins can send roster invites.'
      );
      await replyEphemeral(interaction, { components: [embed] });
      return;
    }

    // Send DM invite with region
    const invite = await sendRosterInvite(
      interaction.client,
      userId,
      guildDoc,
      roster,
      { id: interaction.user.id, username: interaction.user.username },
      region // Pass region to invite
    );

    if (!invite.ok) {
      const embed = createErrorEmbed('Send failed', invite.error || 'DM failed.');
      await interaction.editReply({ components: [embed] });
      return;
    }

    const label = roster === 'main' ? 'Main Roster' : 'Sub Roster';
    const embed = createSuccessEmbed(
      'Invitation sent',
      `DM sent to <@${userId}> for ${label} of "${guildDoc?.name}" (${region}).`
    );
    return interaction.editReply({ components: [embed] });
  } catch (error) {
    if (handleKnownDiscordError(error, interaction)) return;
    LoggerService.error('Error in rosterInviteSendConfirm:', { error });
    const embed = createErrorEmbed('Error', 'Could not process invitation.');
    await replyEphemeral(interaction, { components: [embed] });
  }
}

module.exports = { handle };
