const { createErrorEmbed, createSuccessEmbed } = require('../../utils/embeds/embedBuilder');
const Guild = require('../../models/guild/Guild');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const { auditAdminAction } = require('../../utils/misc/adminAudit');
const LoggerService = require('../../services/LoggerService');

/**
 * Guild data editing modal submit handler
 * CustomId: guild_edit_data_modal:<guildId>
 * @param {ModalSubmitInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    if (!guildId) {
      const embed = createErrorEmbed('Invalid data', 'GuildId not provided.');
      const { MessageFlags } = require('discord.js');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      const { MessageFlags } = require('discord.js');
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
      const { MessageFlags } = require('discord.js');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const name = interaction.fields.getTextInputValue('name')?.trim();
    const bannerUrl = interaction.fields.getTextInputValue('bannerUrl')?.trim();
    const iconUrl = interaction.fields.getTextInputValue('iconUrl')?.trim();
    const color = interaction.fields.getTextInputValue('color')?.trim();
    const description = interaction.fields.getTextInputValue('description')?.trim();

    // Validate color before saving (accepts #RRGGBB or RRGGBB)
    let normalizedColor = color;
    if (normalizedColor) {
      // Add # if missing
      if (!normalizedColor.startsWith('#')) normalizedColor = `#${normalizedColor}`;
      const hexOk = /^#[0-9a-fA-F]{6}$/.test(normalizedColor);
      if (!hexOk) {
        const embed = createErrorEmbed('Invalid color', 'Use a 6-digit hex (e.g., #FFAA00).');
        const { MessageFlags } = require('discord.js');
        return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
      }
    }

    const update = { name, bannerUrl, iconUrl, color: normalizedColor, description };

    // Clean empty fields
    for (const k of Object.keys(update)) {
      if (update[k] === '') update[k] = undefined;
    }

    Object.assign(guildDoc, update);
    await guildDoc.save();

    // Audit: if admin (not leader) edited another guild's data
    const leader = isGuildLeader(guildDoc, interaction.user.id);
    if (admin && !leader) {
      try {
        await auditAdminAction(interaction.guild, interaction.user.id, 'Edit Guild Data', {
          guildName: guildDoc.name,
          guildId,
        });
      } catch (_) { }
    }

    const container = createSuccessEmbed('Data updated', 'Guild information has been updated successfully.');
    const { MessageFlags } = require('discord.js');
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error saving guild data:', { error: error?.message });
    const message = error?.message?.includes('URL') || error?.message?.includes('Color')
      ? error.message
      : 'Could not save the changes.';
    const container = createErrorEmbed('Error', message);
    const { MessageFlags } = require('discord.js');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
    return interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
  }
}

module.exports = { handle };

