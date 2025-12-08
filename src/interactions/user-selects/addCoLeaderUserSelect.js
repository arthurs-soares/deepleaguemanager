const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../utils/embeds/embedBuilder');
const Guild = require('../../models/guild/Guild');
const { isGuildLeader } = require('../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const { sendCoLeaderInvite } = require('../../utils/guilds/sendCoLeaderInvite');
const LoggerService = require('../../services/LoggerService');

/**
 * User Select handler to promote co-leader
 * CustomId: add_co_leader_user_select:<guildId>
 */
async function handle(interaction) {
  try {
    const [, guildId] = interaction.customId.split(':');
    const userId = interaction.values?.[0];
    if (!guildId || !userId) return interaction.deferUpdate();

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
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    if (!admin && !isLeader) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the leader or admin can add a co-leader.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Check if selected user is the guild leader
    if (isGuildLeader(guildDoc, userId)) {
      const embed = createErrorEmbed(
        'Invalid selection',
        'The guild leader cannot be selected as co-leader.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Validate if already co-leader
    const members = Array.isArray(guildDoc.members) ? guildDoc.members : [];
    const existing = members.find(m => m.userId === userId);
    if (existing && existing.role === 'vice-lider') {
      const embed = createErrorEmbed(
        'Already co-leader',
        'This user is already a co-leader in the guild.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Check co-leader limit (1)
    const coCount = members.filter(m => m.role === 'vice-lider').length;
    if (coCount >= 1) {
      const embed = createErrorEmbed(
        'Limit reached',
        'The guild already has a co-leader (max 1).'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Send invite to the user
    const result = await sendCoLeaderInvite(
      interaction.client,
      userId,
      guildDoc,
      { id: interaction.user.id, username: interaction.user.username }
    );

    if (!result.ok) {
      const embed = createErrorEmbed(
        'Could not send invite',
        result.error || 'Failed to send the co-leader invitation.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const embed = createSuccessEmbed(
      'Invitation sent',
      `A co-leader invitation has been sent to <@${userId}>.`
    );
    return interaction.editReply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in addCoLeaderUserSelect:', { error: error?.message });
    const container = createErrorEmbed(
      'Error',
      'Could not complete co-leader invitation.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };

