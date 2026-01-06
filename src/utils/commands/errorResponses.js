const { createErrorEmbed } = require('../embeds/embedBuilder');
const { replyEphemeral } = require('../core/reply');
const { logCommandError } = require('./logging');
const { handleKnownDiscordError } = require('../core/discordErrorUtils');
const LoggerService = require('../../services/LoggerService');

/**
 * Log a command error and send a user-friendly ephemeral response
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {string} commandName
 * @param {Error} error
 * @param {Record<string, any>} optionsObj
 */
async function respondAndLogCommandError(interaction, commandName, error, optionsObj) {
  if (handleKnownDiscordError(error, interaction)) {
    return;
  }

  LoggerService.error(`Error executing command ${commandName}:`, {
    error: error?.message
  });

  await logCommandError(interaction, commandName, error, optionsObj);

  const container = createErrorEmbed(
    'Command Error',
    'An error occurred while executing this command.'
  );

  await replyEphemeral(interaction, { components: [container] });
}

module.exports = { respondAndLogCommandError };

