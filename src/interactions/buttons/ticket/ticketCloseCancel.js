const { MessageFlags } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Cancel ticket closure
 * CustomId: ticket:close:cancel:<ticketId>
 */
async function handle(interaction) {
  try {
    await interaction.update({
      content: '❌ Ticket closure cancelled.',
      components: [],
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error cancelling ticket closure:', { error: error?.message });
    const msg = {
      content: '❌ An error occurred.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

