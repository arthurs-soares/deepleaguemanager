const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle UserSelect for 2v2 teammate selection
 * CustomId: wager:select2v2Teammate
 */
async function handle(interaction) {
  try {
    const teammateId = interaction.values?.[0];
    if (!teammateId) return interaction.deferUpdate();

    // Validate teammate is not the initiator
    if (teammateId === interaction.user.id) {
      return interaction.reply({
        content: '❌ You cannot select yourself as a teammate.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Check if teammate is a bot
    const teammate = await interaction.client.users.fetch(teammateId)
      .catch(() => null);
    if (!teammate) {
      return interaction.reply({
        content: '❌ Could not find the selected user.',
        flags: MessageFlags.Ephemeral
      });
    }
    if (teammate.bot) {
      return interaction.reply({
        content: '❌ You cannot select a bot as your teammate.',
        flags: MessageFlags.Ephemeral
      });
    }

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.depthsWager} 2v2 Wager Challenge`);

    const teamText = new TextDisplayBuilder()
      .setContent(`**Your Team:** <@${interaction.user.id}> & <@${teammateId}>`);

    const descText = new TextDisplayBuilder()
      .setContent(
        '**Step 2/2:** Select both opponents\n\n' +
        'Choose the two players you want to challenge.'
      );

    container.addTextDisplayComponents(titleText, teamText, descText);

    // Select for both opponents (max 2)
    const select = new UserSelectMenuBuilder()
      .setCustomId(`wager:select2v2Opponents:${teammateId}`)
      .setPlaceholder('Select 2 opponents')
      .setMinValues(2)
      .setMaxValues(2);

    const row = new ActionRowBuilder().addComponents(select);

    // Acknowledge original interaction silently
    await interaction.deferUpdate();

    // Send new ephemeral message with opponent selection
    return interaction.followUp({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in wager:select2v2Teammate:', error);
    const msg = {
      content: '❌ Could not process teammate selection.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
