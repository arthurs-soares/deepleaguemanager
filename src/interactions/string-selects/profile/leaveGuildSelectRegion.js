const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Handle region selection for leaving guild
 * CustomId: profile:leaveGuild:selectRegion:<guildId>
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handle(interaction) {
  try {
    const selectedRegion = interaction.values?.[0];
    if (!selectedRegion) {
      return interaction.deferUpdate();
    }

    const safeRegion = selectedRegion.replace(/ /g, '_');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`profile:confirmLeave:yes:${safeRegion}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Leave'),
      new ButtonBuilder()
        .setCustomId('profile:confirmLeave:no')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    return interaction.update({
      content: `⚠️ Leave **${selectedRegion}** roster? This cannot be undone.`,
      components: [row]
    });
  } catch (error) {
    LoggerService.error('Error in leave guild region select:', {
      error: error.message
    });
    const msg = {
      content: '❌ Could not process selection.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
