const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle UserSelect for wager opponent
 * CustomId: wager:selectOpponent
 */
async function handle(interaction) {
  try {
    const opponentId = interaction.values?.[0];
    if (!opponentId) return interaction.deferUpdate();

    // War wagers removed: single option for all users
    const label = '📨 Create Wager Ticket';

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wager:createTicket:${opponentId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel(label)
    );

    return interaction.update({ components: [row] });
  } catch (error) {
    LoggerService.error('Error in wager:selectOpponent:', { error: error?.message });
    const msg = { content: '❌ Could not process selection.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

