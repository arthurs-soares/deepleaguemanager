const { MessageFlags } = require('discord.js');
const { createErrorEmbed } = require('../../utils/embeds/embedBuilder');
const { showRosterActions } = require('../buttons/guild/editRoster');
const LoggerService = require('../../services/LoggerService');
const Guild = require('../../models/guild/Guild');
const { isGuildAdmin } = require('../../utils/core/permissions');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../utils/guilds/guildMemberManager');

/**
 * Region selector for roster management
 * Expected CustomId: roster_region_select:<guildId>
 * @param {StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    const selectedRegion = interaction.values?.[0];

    if (!guildId || !selectedRegion) {
      const embed = createErrorEmbed('Invalid data', 'Missing data.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Fetch guild and verify permissions
    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isServerAdmin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    const isCoLeader = isGuildCoLeader(guildDoc, interaction.user.id);
    const isMgr = isGuildManager(guildDoc, interaction.user.id);

    if (!isServerAdmin && !isLeader && !isCoLeader && !isMgr) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only guild leaders, co-leaders, managers, or server admins can manage rosters.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Show roster actions for the selected region
    return showRosterActions(interaction, guildId, selectedRegion);
  } catch (error) {
    LoggerService.error('Error in roster region select:', error);
    const embed = createErrorEmbed('Error', 'Could not process selection.');
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
