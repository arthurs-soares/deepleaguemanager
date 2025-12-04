const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { SeparatorSpacingSize } = require('discord.js');
const { colors, emojis } = require('../../../config/botConfig');

function buildLeaderboardEmbed() {
  const container = new ContainerBuilder();

  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.trophy} Leaderboards`);
  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} View and manage server rankings.`
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const commandsText = new TextDisplayBuilder()
    .setContent(
      '**Commands:**\n' +
      '`/leaderboard refresh` — Force refresh all leaderboards\n' +
      '`/wager leaderboard` — View wager rankings\n' +
      '`/guild view` — View guild rankings'
    );
  container.addTextDisplayComponents(commandsText);

  const configText = new TextDisplayBuilder()
    .setContent(
      '**Configuration:**\n' +
      'Set the leaderboard channel in `/config` → Channels → Leaderboard. ' +
      'The bot auto-updates rankings daily at 00:05 UTC.'
    );
  container.addTextDisplayComponents(configText);

  const featuresText = new TextDisplayBuilder()
    .setContent(
      '**Features:**\n' +
      '• Guild win/loss rankings\n' +
      '• Wager ELO rankings\n' +
      '• Automatic daily updates\n' +
      '• Paginated display'
    );
  container.addTextDisplayComponents(featuresText);

  return container;
}

module.exports = { buildLeaderboardEmbed };

