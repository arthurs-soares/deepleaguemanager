const { ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { isGuildLeader } = require('../../../utils/guilds/guildMemberManager');
const { createErrorEmbed } = require('../../../utils/embeds/embedBuilder');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const { hasCoLeader } = require('../../../utils/guilds/guildPanelComponents');
const LoggerService = require('../../../services/LoggerService');

/**
 * "Change Co-leader" button handler
 * CustomId: guild_panel:change_co_leader:<guildId>
 * Only the current leader can use it.
 */
async function handle(interaction) {
  try {
    const [, , guildId] = interaction.customId.split(':');
    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      return interaction.reply({ content: '❌ Guild not found.', flags: MessageFlags.Ephemeral });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    if (!admin && !isGuildLeader(guildDoc, interaction.user.id)) {
      const embed = createErrorEmbed('Permission denied', 'Only the guild leader or a server administrator can change the co-leader.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Check if co-leader exists
    if (!hasCoLeader(guildDoc)) {
      const embed = createErrorEmbed('No co-leader', 'This guild does not have a co-leader to change.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(`change_co_leader_user_select:${guildId}`)
      .setPlaceholder('Select the new co-leader')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);
    return interaction.reply({ components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error in Change Co-leader button:', { error: error?.message });
    const container = createErrorEmbed('Error', 'Could not start co-leader change.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
}

module.exports = { handle };
