const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../utils/embeds/embedBuilder');
const Guild = require('../../models/guild/Guild');
const { isGuildLeader } = require('../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const {
  sendLeadershipInvite
} = require('../../utils/guilds/sendLeadershipInvite');
const LoggerService = require('../../services/LoggerService');

/**
 * User Select handler to choose new leader
 * CustomId: transfer_leader_user_select:<guildId>
 * Sends an invitation to the selected user instead of direct transfer
 * @param {UserSelectMenuInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    if (!guildId) {
      const embed = createErrorEmbed('Invalid data', 'GuildId not provided.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const newLeaderId = interaction.values?.[0];
    if (!newLeaderId) return interaction.deferUpdate();

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    if (!admin && !isGuildLeader(guildDoc, interaction.user.id)) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the current leader or admin can transfer leadership.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Check if selected user is already the leader
    if (isGuildLeader(guildDoc, newLeaderId)) {
      const embed = createErrorEmbed(
        'Invalid selection',
        'This user is already the guild leader.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Send leadership invitation
    const result = await sendLeadershipInvite(
      interaction.client,
      newLeaderId,
      guildDoc,
      { id: interaction.user.id, username: interaction.user.username }
    );

    if (!result.ok) {
      const embed = createErrorEmbed(
        'Could not send invite',
        result.error || 'Failed to send the leadership invitation.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const embed = createSuccessEmbed(
      'Invitation sent',
      `A leadership invitation has been sent to <@${newLeaderId}>.\n\n` +
      `The transfer will only be completed when they accept the invitation.`
    );
    return interaction.editReply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in transferLeaderUserSelect:', { error: error?.message });
    const embed = createErrorEmbed('Error', 'Could not send the invitation.');
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }
    return interaction.reply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };

