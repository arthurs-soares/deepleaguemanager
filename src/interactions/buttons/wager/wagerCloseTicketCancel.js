const { MessageFlags } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');

/**
 * Cancel wager ticket closure
 * CustomId: wager:closeTicket:cancel:<ticketId>
 */
async function handle(interaction) {
  try {
    const container = new ContainerBuilder()
      .setAccentColor(colors.error)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('### ❌ Closure Cancelled')
      );

    await interaction.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error cancelling wager ticket closure:', { error });
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

