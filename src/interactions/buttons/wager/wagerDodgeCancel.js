const { MessageFlags } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Cancel wager dodge confirmation
 * CustomId: wager:dodge:cancel:<ticketId>:<sourceMessageId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const ticketId = parts[3];
    if (!ticketId) return interaction.editReply({ content: 'Action cancelled.' });

    try { await interaction.message.edit({ components: [] }).catch(() => { }); } catch (_) { }
    return interaction.editReply({ content: '❎ Dodge cancelled.' });
  } catch (error) {
    LoggerService.error('Error in button wager:dodge:cancel:', { error: error?.message });
    const msg = { content: '❌ Could not cancel.' };
    const payload = { ...msg, flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(payload);
    return interaction.reply(payload);
  }
}

module.exports = { handle };

