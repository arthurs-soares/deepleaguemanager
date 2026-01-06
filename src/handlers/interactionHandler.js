const { setCooldown } = require('../utils/rate-limiting/cooldownManager');
const { safeDeferEphemeral } = require('../utils/core/ack');
const { safeDeferReply } = require('../utils/core/ack');
const { shouldBypassCooldown } = require('../utils/rate-limiting/shouldBypassCooldown');
const { serializeOptions } = require('../utils/commands/optionsSerializer');
const { enforceCommandCooldown } = require('../utils/commands/cooldownGuard');
const { logCommandSuccess } = require('../utils/commands/logging');
const { respondAndLogCommandError } = require('../utils/commands/errorResponses');
const LoggerService = require('../services/LoggerService');

/**
 * Handles slash command interactions
 * @param {ChatInputCommandInteraction} interaction - Slash command interaction
 */
async function handleSlashCommand(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);
  if (!command) {
    LoggerService.warn(`Command ${interaction.commandName} not found`);
    return;
  }

  const autoDefer = typeof command.autoDefer === 'function'
    ? command.autoDefer(interaction)
    : command.autoDefer;

  if (autoDefer === 'ephemeral') await safeDeferEphemeral(interaction);
  if (autoDefer === 'public') await safeDeferReply(interaction);

  const cooldownKey = `${interaction.user.id}:${interaction.commandName}`;
  const bypassCooldown = await shouldBypassCooldown(interaction, command);
  if (!bypassCooldown) {
    const { blocked } = await enforceCommandCooldown(interaction, command, cooldownKey);
    if (blocked) return;
  }

  const optionsObj = serializeOptions(interaction);

  try {
    await command.execute(interaction);
    if (!bypassCooldown) setCooldown(cooldownKey);
    await logCommandSuccess(interaction, interaction.commandName, optionsObj);
  } catch (error) {
    await respondAndLogCommandError(
      interaction, interaction.commandName, error, optionsObj
    );
  }
}

module.exports = { handleSlashCommand };
