const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');
const { warLogSessions } = require('../../commands/admin/log');
const { buildPreviewContainer } = require('../../utils/war/warLogContainer');
const { buildRoundButtons } = require('../../utils/war/warLogButtons');

/**
 * Handle round modal submission
 * CustomId: wl:rm:<roundNum>:<sessionId>
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const roundNum = parseInt(parts[2], 10);
    const sessionId = parts[3];

    const sessionData = warLogSessions.get(sessionId);
    if (!sessionData) {
      return interaction.reply({
        content: '❌ Session expired. Please use the command again.',
        flags: MessageFlags.Ephemeral
      });
    }

    const deathsAStr = interaction.fields.getTextInputValue('deathsA');
    const deathsBStr = interaction.fields.getTextInputValue('deathsB');
    const clip = interaction.fields.getTextInputValue('clip') || null;

    const deathsA = parseInt(deathsAStr, 10);
    const deathsB = parseInt(deathsBStr, 10);

    if (isNaN(deathsA) || isNaN(deathsB) || deathsA < 0 || deathsB < 0) {
      return interaction.reply({
        content: '❌ Invalid deaths value. Enter a positive number.',
        flags: MessageFlags.Ephemeral
      });
    }

    sessionData.rounds[roundNum - 1] = { deathsA, deathsB, clip };

    const isEdit = sessionData.isEdit === true;
    const header = isEdit ? `📝 Editing war log` : null;
    const container = buildPreviewContainer(sessionData, header);
    const buttonRows = buildRoundButtons(sessionId, sessionData.rounds.length, isEdit);

    await interaction.update({
      components: [container, ...buttonRows],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in warLogModal:', { error: error?.message });
    const msg = { content: '❌ Unable to save round.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
