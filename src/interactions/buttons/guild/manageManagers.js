const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const Guild = require('../../../models/guild/Guild');
const { isGuildLeader } = require('../../../utils/guilds/guildMemberManager');
const { createErrorEmbed } = require('../../../utils/embeds/embedBuilder');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const { colors } = require('../../../config/botConfig');

/**
 * "Manage Managers" button handler
 * CustomId: guild_panel:manage_managers:<guildId>
 * Only the leader can use it.
 */
async function handle(interaction) {
  try {
    const [, , guildId] = interaction.customId.split(':');
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
    if (!admin && !isGuildLeader(guildDoc, interaction.user.id)) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the guild leader can manage managers.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const managers = Array.isArray(guildDoc.managers) ? guildDoc.managers : [];

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# Manage Guild Managers');

    const descText = new TextDisplayBuilder()
      .setContent(
        'Managers can access the guild panel but do not need to be in the roster.\n' +
        `**Current managers (${managers.length}/2):**\n` +
        (managers.length > 0
          ? managers.map(id => `• <@${id}>`).join('\n')
          : '*No managers assigned*')
      );

    container.addTextDisplayComponents(titleText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(descText);

    const components = [container];

    // Add user select to add managers if limit not reached
    if (managers.length < 2) {
      const userSelect = new UserSelectMenuBuilder()
        .setCustomId(`add_manager_user_select:${guildId}`)
        .setPlaceholder('Select a user to invite as manager')
        .setMinValues(1)
        .setMaxValues(1);
      const selectRow = new ActionRowBuilder().addComponents(userSelect);
      components.push(selectRow);
    }

    // Add remove buttons for each manager
    if (managers.length > 0) {
      const removeRow = new ActionRowBuilder();
      for (const managerId of managers.slice(0, 5)) {
        // Try to get the member's display name
        let displayName = managerId;
        try {
          const member = await interaction.guild.members.fetch(managerId).catch(() => null);
          if (member) {
            displayName = member.displayName.slice(0, 15);
          }
        } catch (_) { /* ignore */ }
        removeRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`manager:remove:${guildId}:${managerId}`)
            .setLabel(`Remove ${displayName}`)
            .setStyle(ButtonStyle.Danger)
        );
      }
      components.push(removeRow);
    }

    return interaction.reply({
      components,
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    const embed = createErrorEmbed('Error', 'Could not open managers panel.');
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
