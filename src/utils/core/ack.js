const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/** Max age (ms) before autocomplete interaction is considered stale */
const MAX_AUTOCOMPLETE_AGE_MS = 2500;

/** Max age (ms) before interaction is considered stale (3s limit) */
const MAX_INTERACTION_AGE_MS = 2800;

/** Known Discord error codes for expired/acknowledged interactions */
const BENIGN_CODES = [10062, 40060, 50027];

/**
 * Check if error code is a benign Discord interaction error
 * @param {Error} e - Error object
 * @returns {boolean}
 */
function isBenignError(e) {
  const code = e?.code ?? e?.rawError?.code;
  return BENIGN_CODES.includes(code);
}

/**
 * Check if interaction is likely expired (past 3s window)
 * @param {import('discord.js').Interaction} interaction
 * @returns {boolean}
 */
function isInteractionStale(interaction) {
  const age = Date.now() - (interaction.createdTimestamp || Date.now());
  return age > MAX_INTERACTION_AGE_MS;
}

/**
 * Safe helper to respond to autocomplete interactions.
 * Handles race conditions where multiple autocomplete requests
 * arrive in quick succession.
 * @param {import('discord.js').AutocompleteInteraction} interaction
 * @param {Array} choices - Autocomplete choices array
 * @returns {Promise<boolean>} - True if response was sent
 */
async function safeAutocompleteRespond(interaction, choices = []) {
  try {
    const age = Date.now() - (interaction.createdTimestamp || Date.now());
    if (age > MAX_AUTOCOMPLETE_AGE_MS) return false;
    if (interaction.responded) return false;

    await interaction.respond(choices);
    return true;
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

/**
 * Safe helper to defer ephemeral replies without double-ack errors.
 * - Checks for stale interaction before deferring
 * - Only defers if not already deferred/replied
 * - Catches Unknown interaction (10062) and Already acknowledged (40060)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<boolean>} - True if defer was successful
 */
async function safeDeferEphemeral(interaction) {
  try {
    if (isInteractionStale(interaction)) {
      LoggerService.warn('Interaction stale, skipping defer:', {
        type: interaction.type,
        customId: interaction.customId,
        userId: interaction.user?.id
      });
      return false;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      return true;
    }
    return true; // Already deferred/replied
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

/**
 * Safe helper to defer public replies without double-ack errors.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {Promise<boolean>} - True if defer was successful
 */
async function safeDeferReply(interaction) {
  try {
    if (isInteractionStale(interaction)) {
      LoggerService.warn('Interaction stale, skipping defer:', {
        type: interaction.type,
        customId: interaction.customId,
        userId: interaction.user?.id
      });
      return false;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
      return true;
    }
    return true;
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

/**
 * Safe helper to defer component update without double-ack errors.
 * Useful for buttons/selects that intend to update the original message
 * after doing async work. After deferring, prefer editing the message.
 * @param {import('discord.js').MessageComponentInteraction} interaction
 * @returns {Promise<boolean>} - True if defer was successful
 */
async function safeDeferUpdate(interaction) {
  try {
    if (isInteractionStale(interaction)) {
      LoggerService.warn('Interaction stale, skipping deferUpdate:', {
        customId: interaction.customId,
        userId: interaction.user?.id
      });
      return false;
    }
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferUpdate();
      return true;
    }
    return true;
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

/**
 * Safe helper to edit reply after deferring.
 * Returns false if interaction is expired/invalid.
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').InteractionReplyOptions} options
 * @returns {Promise<boolean>} - True if edit was successful
 */
async function safeEditReply(interaction, options) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      LoggerService.warn('Cannot editReply: not deferred/replied');
      return false;
    }
    await interaction.editReply(options);
    return true;
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

/**
 * Safe helper to send followUp message.
 * Returns false if interaction is expired/invalid.
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').InteractionReplyOptions} options
 * @returns {Promise<boolean>} - True if followUp was successful
 */
async function safeFollowUp(interaction, options) {
  try {
    await interaction.followUp(options);
    return true;
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

/**
 * Safe helper to update component message.
 * Returns false if interaction is expired/invalid.
 * @param {import('discord.js').MessageComponentInteraction} interaction
 * @param {import('discord.js').InteractionUpdateOptions} options
 * @returns {Promise<boolean>} - True if update was successful
 */
async function safeUpdate(interaction, options) {
  try {
    if (isInteractionStale(interaction)) {
      LoggerService.warn('Interaction stale, skipping update:', {
        customId: interaction.customId,
        userId: interaction.user?.id
      });
      return false;
    }
    if (interaction.deferred || interaction.replied) {
      return safeEditReply(interaction, options);
    }
    await interaction.update(options);
    return true;
  } catch (e) {
    if (isBenignError(e)) return false;
    throw e;
  }
}

module.exports = {
  safeDeferEphemeral,
  safeDeferReply,
  safeDeferUpdate,
  safeEditReply,
  safeFollowUp,
  safeUpdate,
  safeAutocompleteRespond,
  isInteractionStale,
  isBenignError,
  BENIGN_CODES
};
