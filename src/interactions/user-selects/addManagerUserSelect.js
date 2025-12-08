const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const Guild = require('../../models/guild/Guild');
const { isGuildLeader } = require('../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const { createErrorEmbed } = require('../../utils/embeds/embedBuilder');
const { colors, emojis } = require('../../config/botConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * User Select handler to invite a manager
 * CustomId: add_manager_user_select:<guildId>
 */
async function handle(interaction) {
  try {
    const [, guildId] = interaction.customId.split(':');
    const userId = interaction.values?.[0];
    if (!guildId || !userId) return interaction.deferUpdate();

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    if (!admin && !isLeader) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the guild leader can add managers.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const managers = Array.isArray(guildDoc.managers) ? guildDoc.managers : [];

    // Validate manager limit
    if (managers.length >= 2) {
      const embed = createErrorEmbed(
        'Limit reached',
        'The guild already has the maximum number of managers (2).'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Check if already a manager
    if (managers.includes(userId)) {
      const embed = createErrorEmbed(
        'Already a manager',
        'This user is already a manager of this guild.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Fetch target user
    const targetUser = await interaction.client.users.fetch(userId)
      .catch(() => null);
    if (!targetUser) {
      const embed = createErrorEmbed('Not found', 'User not found.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const username = targetUser?.username || userId;

    // Build confirmation message
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning || '⚠️'} Confirm Manager Invitation`);

    const descText = new TextDisplayBuilder()
      .setContent(
        `Are you sure you want to invite the following user ` +
        `as a **Manager** of **${guildDoc.name}**?`
      );

    const userText = new TextDisplayBuilder()
      .setContent(
        `**User:** <@${userId}>\n` +
        `**Username:** ${username}`
      );

    container.addTextDisplayComponents(titleText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(descText);
    container.addTextDisplayComponents(userText);

    const confirmBtn = new ButtonBuilder()
      .setCustomId(`manager:inviteConfirm:${guildId}:${userId}:yes`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`manager:inviteConfirm:${guildId}:${userId}:no`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in addManagerUserSelect:', { error: error?.message });
    const container = createErrorEmbed(
      'Error',
      'Could not send the manager invitation.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
