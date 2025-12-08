const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
  buildGuildDetailDisplayComponents
} = require('../../../utils/embeds/guildDetailEmbed');
const {
  createErrorEmbed
} = require('../../../utils/embeds/embedBuilder');
const LoggerService = require('../../../services/LoggerService');

/**
 * Handle region selection in guild view (/guild view)
 * CustomId: guild_view:select_region:<guildId>
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
  try {
    const [, , guildId] = interaction.customId.split(':');
    const selectedRegion = interaction.values?.[0];

    if (!guildId || !selectedRegion) {
      return interaction.deferUpdate();
    }

    const guild = await Guild.findById(guildId);
    if (!guild) {
      const container = createErrorEmbed(
        'Guild Not Found',
        'The guild was not found.'
      );
      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Rebuild detail view with selected region
    const container = await buildGuildDetailDisplayComponents(
      guild,
      interaction.guild,
      selectedRegion
    );

    // Re-add the history button
    const historyButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`viewGuild:history:${guild._id}`)
        .setStyle(ButtonStyle.Primary)
        .setLabel('📊 History')
    );

    return interaction.update({
      components: [container, historyButton],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in guild view region select:', { error: error?.message });
    try {
      const container = createErrorEmbed('Error', 'An error occurred.');
      return interaction.update({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (_) {
      // Ignore if update fails
    }
  }
}

module.exports = { handle };
