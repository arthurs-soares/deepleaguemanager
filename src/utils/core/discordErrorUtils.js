const LoggerService = require('../../services/LoggerService');

/**
 * Handle known Discord API interaction errors in a consistent way.
 * Returns true if the error was handled and no further response is needed.
 * @param {any} error
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean}
 */
function handleKnownDiscordError(error, interaction) {
  const code = error?.code ?? error?.rawError?.code;

  if (code === 10062) {
    // Unknown interaction - token expired, log but don't respond
    LoggerService.warn('Interaction token expired:', {
      type: interaction?.type,
      customId: interaction?.customId || 'N/A',
      userId: interaction?.user?.id,
      age: Date.now() - (interaction?.createdTimestamp || Date.now())
    });
    return true;
  }

  if (code === 40060) {
    // Interaction already acknowledged, log but don't respond
    LoggerService.warn('Interaction already acknowledged:', {
      type: interaction?.type,
      customId: interaction?.customId || 'N/A',
      userId: interaction?.user?.id
    });
    return true;
  }

  if (code === 50035 && error?.message?.includes('COMPONENT_LAYOUT_WIDTH_EXCEEDED')) {
    // Component width exceeded - log but don't try to respond
    LoggerService.error('Component width exceeded in interaction:', {
      type: interaction?.type,
      customId: interaction?.customId || 'N/A',
      userId: interaction?.user?.id,
      guildId: interaction?.guild?.id,
      errorMessage: error.message
    });
    return true;
  }

  return false;
}

module.exports = { handleKnownDiscordError };

