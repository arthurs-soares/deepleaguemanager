const { ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const { createErrorEmbed } = require('../../../utils/embeds/embedBuilder');
const Guild = require('../../../models/guild/Guild');
const { isGuildLeader } = require('../../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const LoggerService = require('../../../services/LoggerService');

/**
 * "Transfer Leadership" button handler
 * CustomId: guild_panel:transfer_leadership:<guildId>
 * Opens a User Select to choose the new leader.
 * Only the current leader can use it.
 * @param {ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    if (!guildId) {
      const embed = createErrorEmbed('Invalid data', 'GuildId not provided.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    if (!admin && !isGuildLeader(guildDoc, interaction.user.id)) {
      const embed = createErrorEmbed('Permission denied', 'Only the guild leader or a server administrator can transfer leadership.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId(`transfer_leader_user_select:${guildId}`)
      .setPlaceholder('Select the new leader')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(userSelect);
    return interaction.reply({ components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error in Transfer Leadership button:', { error: error?.message });
    const embed = createErrorEmbed('Error', 'Could not start leadership transfer.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
}

module.exports = { handle };
