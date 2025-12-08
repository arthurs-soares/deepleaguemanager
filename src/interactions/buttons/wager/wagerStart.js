const { ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');

/**
 * Start wager challenge flow
 * CustomId: wager:start
 */
async function handle(interaction) {
  try {

    const descBase = 'Choose an opponent to open a wager ticket. A private channel will be created for coordination.';

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# Wager Challenge');

    const descText = new TextDisplayBuilder()
      .setContent(descBase);

    container.addTextDisplayComponents(titleText, descText);

    const select = new UserSelectMenuBuilder()
      .setCustomId('wager:selectOpponent')
      .setPlaceholder('Select the opponent user')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in wager:start button:', { error: error?.message });
    const msg = { content: '❌ Could not start wager flow.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

