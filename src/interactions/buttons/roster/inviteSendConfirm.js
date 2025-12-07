const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { getGuildById } = require('../../../utils/roster/rosterManager');
const { sendRosterInvite } = require('../../../utils/roster/sendRosterInvite');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../../utils/guilds/guildMemberManager');
const LoggerService = require('../../../services/LoggerService');

/**
 * Handle roster invite send confirmation
 * CustomId: rosterInvite:sendConfirm:<guildId>:<roster>:<userId>:yes|no:<region>
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const roster = parts[3];
    const userId = parts[4];
    const decision = parts[5];
    // Decode region (underscores back to spaces)
    const region = parts[6]?.replace(/_/g, ' ');

    if (!guildId || !roster || !userId || !decision || !region) {
      const embed = createErrorEmbed('Invalid data', 'Missing confirmation.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    if (decision === 'no') {
      const embed = createSuccessEmbed('Cancelled', 'Invitation was cancelled.');
      return interaction.update({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not in database.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
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
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    await interaction.deferUpdate();

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
      return interaction.editReply({ components: [embed] });
    }

    const label = roster === 'main' ? 'Main Roster' : 'Sub Roster';
    const embed = createSuccessEmbed(
      'Invitation sent',
      `DM sent to <@${userId}> for ${label} of "${guildDoc?.name}" (${region}).`
    );
    return interaction.editReply({ components: [embed] });
  } catch (error) {
    LoggerService.error('Error in rosterInviteSendConfirm:', { error });
    const embed = createErrorEmbed('Error', 'Could not process invitation.');
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
