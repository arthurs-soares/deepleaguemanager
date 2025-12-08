const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle UserSelect for 2v2 opponents selection
 * CustomId: wager:select2v2Opponents:<teammateId>
 */
async function handle(interaction) {
  try {
    const [, , teammateId] = interaction.customId.split(':');
    const opponentIds = interaction.values || [];

    if (opponentIds.length !== 2) {
      return interaction.reply({
        content: '❌ You must select exactly 2 opponents.',
        flags: MessageFlags.Ephemeral
      });
    }

    const initiatorId = interaction.user.id;

    // Validate opponents are not in the initiator's team
    if (opponentIds.includes(initiatorId)) {
      return interaction.reply({
        content: '❌ You cannot select yourself as an opponent.',
        flags: MessageFlags.Ephemeral
      });
    }
    if (opponentIds.includes(teammateId)) {
      return interaction.reply({
        content: '❌ Your teammate cannot be selected as an opponent.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Validate opponents are different
    if (opponentIds[0] === opponentIds[1]) {
      return interaction.reply({
        content: '❌ Both opponents must be different users.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Fetch and validate all users
    const [opponent1, opponent2] = await Promise.all([
      interaction.client.users.fetch(opponentIds[0]).catch(() => null),
      interaction.client.users.fetch(opponentIds[1]).catch(() => null)
    ]);

    if (!opponent1 || !opponent2) {
      return interaction.reply({
        content: '❌ Could not find one or more opponents.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (opponent1.bot || opponent2.bot) {
      return interaction.reply({
        content: '❌ You cannot select bots as opponents.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Build confirmation container
    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.depthsWager} 2v2 Wager Confirmation`);

    const teamAText = new TextDisplayBuilder()
      .setContent(
        `**Your Team:**\n` +
        `<@${initiatorId}> & <@${teammateId}>`
      );

    const vsText = new TextDisplayBuilder()
      .setContent('**VS**');

    const teamBText = new TextDisplayBuilder()
      .setContent(
        `**Opponent Team:**\n` +
        `<@${opponentIds[0]}> & <@${opponentIds[1]}>`
      );

    container.addTextDisplayComponents(titleText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(teamAText, vsText, teamBText);
    container.addSeparatorComponents(new SeparatorBuilder());

    const infoText = new TextDisplayBuilder()
      .setContent(
        'Click **Create Ticket** to open a private channel ' +
        'for all participants.'
      );
    container.addTextDisplayComponents(infoText);

    // Button to create the 2v2 ticket
    // Format: wager:createTicket2v2:<teammateId>:<opponent1Id>:<opponent2Id>
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(
          `wager:createTicket2v2:${teammateId}:${opponentIds[0]}:${opponentIds[1]}`
        )
        .setStyle(ButtonStyle.Success)
        .setLabel('📨 Create Wager Ticket')
    );

    return interaction.update({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in wager:select2v2Opponents:', { error: error?.message });
    const msg = {
      content: '❌ Could not process opponent selection.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
