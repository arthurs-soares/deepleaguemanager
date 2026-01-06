const { MessageFlags } = require('discord.js');
const { safeDeferUpdate, safeFollowUp } = require('../../../utils/core/ack');

/**
 * Cancel the war winner declaration
 * CustomId: war:declareWinner:cancel:<warId>
 */
async function handle(interaction) {
  try {
    const deferred = await safeDeferUpdate(interaction);
    if (!deferred) return;

    // Remove the confirmation message components
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) {}

    return safeFollowUp(interaction, {
      content: '❌ Winner declaration cancelled.',
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    const msg = {
      content: '❌ Could not cancel.',
      flags: MessageFlags.Ephemeral
    };
    return safeFollowUp(interaction, msg);
  }
}

module.exports = { handle };
