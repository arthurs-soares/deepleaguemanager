const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../../config/botConfig');

function buildLeaderboardEmbed() {
  const container = new ContainerBuilder();

  // Set accent color
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent('# 🏆 Leaderboards');
  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Use \`/leaderboard\` to view guild rankings.\n` +
      `${emojis.info} You can configure automatic leaderboard channels ` +
      `in \`/config\` → Channels → Set Leaderboard.`
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // How it works
  const howItWorksText = new TextDisplayBuilder()
    .setContent(
      '**How it works**\n' +
      'The bot can publish daily (00:05) embeds with rankings. ' +
      'Guild leaderboard shows win/loss rates with pagination.'
    );
  container.addTextDisplayComponents(howItWorksText);

  return container;
}

module.exports = { buildLeaderboardEmbed };

