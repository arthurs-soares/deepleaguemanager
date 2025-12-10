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

    // Send invitation instead of immediate update
    const { sendChangeCoLeaderInvite } = require('../../utils/guilds/sendChangeCoLeaderInvite');

    // We pass the current co-leader ID so we know who is being replaced
    const result = await sendChangeCoLeaderInvite(
      interaction.client,
      userId,
      guildDoc,
      { id: interaction.user.id, username: interaction.user.username },
      currentCoLeader.userId
    );

    if (!result.ok) {
      const embed = createErrorEmbed('Error', result.error || 'Failed to send invitation.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const embed = createSuccessEmbed(
      'Invitation sent',
      `An invitation has been sent to <@${userId}> to replace <@${currentCoLeader.userId}> as co-leader.`
    );
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



module.exports = { handle };
