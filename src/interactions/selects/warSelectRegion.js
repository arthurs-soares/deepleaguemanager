const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder
} = require('discord.js');
const Guild = require('../../models/guild/Guild');
const LoggerService = require('../../services/LoggerService');

/** Max age (ms) before selection is skipped */
const MAX_AGE_MS = 2500;

/**
 * Region selection for war creation - now opens modal for opponent name
 * CustomId: war:selectRegion:<guildAId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('war:selectRegion skipped (expired)', { age });
      return;
    }

    const [, , guildAId] = interaction.customId.split(':');
    const selectedRegion = interaction.values?.[0];
    if (!guildAId || !selectedRegion) return interaction.deferUpdate();

    const guildA = await Guild.findById(guildAId).select('name');
    if (!guildA) {
      return interaction.update({
        content: '❌ Your guild was not found.',
        components: []
      });
    }

    // Encode region for safe customId (replace spaces with underscores)
    const safeRegion = selectedRegion.replace(/ /g, '_');

    // Open modal to ask for opponent guild name
    const modal = new ModalBuilder()
      .setCustomId(`war:opponentModal:${guildAId}:${safeRegion}`)
      .setTitle('Select Opponent Guild');

    const opponentInput = new TextInputBuilder()
      .setCustomId('opponentName')
      .setLabel('Opponent Guild Name')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('Type the exact name of the opponent guild')
      .setMinLength(1)
      .setMaxLength(100);

    modal.addComponents(
      new ActionRowBuilder().addComponents(opponentInput)
    );

    return interaction.showModal(modal);
  } catch (error) {
    LoggerService.error('Error in war:selectRegion select:', error);
    return interaction.update({
      content: '❌ Error selecting region.',
      components: []
    });
  }
}

module.exports = { handle };
