const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
  buildGuildPanelDisplayComponents
} = require('../../../utils/embeds/guildPanelEmbed');
const {
  createErrorEmbed
} = require('../../../utils/embeds/embedBuilder');
const LoggerService = require('../../../services/LoggerService');

/**
 * Handle region selection in guild panel
 * CustomId: guild_panel:select_region:<guildId>
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

    // Rebuild panel with selected region
    const container = await buildGuildPanelDisplayComponents(
      guild,
      interaction.guild,
      selectedRegion
    );

    return interaction.update({
      components: Array.isArray(container) ? container : [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in guild region select:', { error: error?.message });
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
