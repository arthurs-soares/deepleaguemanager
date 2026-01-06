const { MessageFlags } = require('discord.js');
const { isInteractionStale, BENIGN_CODES } = require('./ack');

/**
 * Reply ephemerally, choosing between reply/editReply/followUp based on state.
 * Automatically detects Components v2 usage and adds appropriate flags.
 * Swallows common Discord errors when the interaction is expired (10062)
 * or already acknowledged elsewhere (40060) to avoid cascading logs.
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').InteractionReplyOptions & import('discord.js').InteractionUpdateOptions} options
 */
async function replyEphemeral(interaction, options = {}) {
  // Check if interaction is stale before attempting to reply
  if (isInteractionStale(interaction)) {
    return;
  }

  // Detect if using Components v2 (components array with ContainerBuilder)
  const hasComponentsV2 = options.components && Array.isArray(options.components) &&
    options.components.some(c => c && c.constructor && c.constructor.name === 'ContainerBuilder');

  // Build flags: always ephemeral, add IsComponentsV2 if detected
  let flags = MessageFlags.Ephemeral;
  if (hasComponentsV2) {
    flags = flags | MessageFlags.IsComponentsV2;
  }
  // Preserve any existing flags from options
  if (options.flags) {
    flags = flags | options.flags;
  }

  const payload = { ...options, flags };

  try {
    if (interaction.deferred && !interaction.replied && typeof interaction.editReply === 'function') {
      // Prefer editing the deferred placeholder message
      const { flags: _flags, ...editPayload } = payload; // flags not applicable to edit
      return await interaction.editReply(editPayload);
    }
    if (interaction.replied) {
      return await interaction.followUp(payload);
    }
    return await interaction.reply(payload);
  } catch (e) {
    const code = e?.code ?? e?.rawError?.code;
    if (BENIGN_CODES.includes(code)) {
      // Best effort: nothing more we can do here safely.
      // Token expired or invalid - interaction is no longer usable
      return;
    }
    throw e;
  }
}

module.exports = { replyEphemeral };
