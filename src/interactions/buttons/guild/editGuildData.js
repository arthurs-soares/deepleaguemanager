const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { createErrorEmbed } = require('../../../utils/embeds/embedBuilder');
const Guild = require('../../../models/guild/Guild');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const LoggerService = require('../../../services/LoggerService');

/**
 * "Edit Data" button handler
 * CustomId: guild_panel:edit_data:<guildId>
 * Opens a modal to edit guild data.
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
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    const isCoLeader = isGuildCoLeader(guildDoc, interaction.user.id);
    const isManager = isGuildManager(guildDoc, interaction.user.id);

    if (!admin && !isLeader && !isCoLeader && !isManager) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only the guild leader, co-leader, manager, or server administrator can edit the data.'
      );
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const modal = new ModalBuilder()
      .setCustomId(`guild_edit_data_modal:${guildId}`)
      .setTitle('Edit guild data');

    const nameInput = new TextInputBuilder()
      .setCustomId('name')
      .setLabel('Guild Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(100)
      .setValue(guildDoc.name || '');

    const bannerInput = new TextInputBuilder()
      .setCustomId('bannerUrl')
      .setLabel('Banner (image URL)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(guildDoc.bannerUrl || '');

    const iconInput = new TextInputBuilder()
      .setCustomId('iconUrl')
      .setLabel('Icon (image URL)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(guildDoc.iconUrl || '');

    const colorInput = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Color (hex, e.g., #FFAA00)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(guildDoc.color || '');

    const descInput = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setMaxLength(1000)
      .setValue(guildDoc.description || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(nameInput),
      new ActionRowBuilder().addComponents(bannerInput),
      new ActionRowBuilder().addComponents(iconInput),
      new ActionRowBuilder().addComponents(colorInput),
      new ActionRowBuilder().addComponents(descInput),
    );

    return interaction.showModal(modal);
  } catch (error) {
    LoggerService.error('Error in Edit Data button:', { error: error?.message });
    const embed = createErrorEmbed('Error', 'Could not open the edit form.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
}

module.exports = { handle };
