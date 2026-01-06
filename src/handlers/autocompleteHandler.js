const LoggerService = require('../services/LoggerService');
const { safeAutocompleteRespond } = require('../utils/core/ack');

/** Max age (ms) before autocomplete is considered stale */
const MAX_AGE_MS = 2500;

/**
 * Routes autocomplete interactions to the command's autocomplete method
 * @param {AutocompleteInteraction} interaction
 */
async function handleAutocomplete(interaction) {
  try {
    // Early expiration check - autocomplete must respond quickly
    const age = Date.now() - (interaction.createdTimestamp || Date.now());
    if (age > MAX_AGE_MS) return;

    const command = interaction.client.commands.get(interaction.commandName);
    if (!command || typeof command.autocomplete !== 'function') return;

    await command.autocomplete(interaction);
  } catch (error) {
    LoggerService.error('Error in handleAutocomplete:', { error: error?.message });
    // Only try to respond if we haven't already responded
    await safeAutocompleteRespond(interaction, []);
  }
}

module.exports = { handleAutocomplete };

