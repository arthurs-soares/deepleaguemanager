const LoggerService = require('../../../services/LoggerService');
/**
 * Cancel dodge confirmation
 * CustomId: war:dodge:cancel:<warId>:<sourceMessageId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const parts = interaction.customId.split(':');
    const warId = parts[3];
    if (!warId) return interaction.editReply({ content: 'Action cancelled.' });

    try { await interaction.message.edit({ components: [] }).catch(() => { }); } catch (_) { }
    return interaction.editReply({ content: '❎ Dodge cancelled.' });
  } catch (error) {
    LoggerService.error('Error in button war:dodge:cancel:', { error: error?.message });
    const msg = { content: '❌ Could not cancel.' };
    if (interaction.deferred || interaction.replied) return interaction.followUp({ ...msg, ephemeral: true });
    return interaction.reply({ ...msg, ephemeral: true });
  }
}

module.exports = { handle };

