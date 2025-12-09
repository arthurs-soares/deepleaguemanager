const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');

/**
 * Build the wager result container
 * @param {string} actorId
 * @param {string} winnerId
 * @param {string} loserId
 * @param {Object} wUser Discord User object
 * @param {Object} lUser Discord User object
 * @param {Object} winnerProfile
 * @param {Object} loserProfile
 */
function buildWagerResultContainer(actorId, winnerId, loserId, wUser, lUser, winnerProfile, loserProfile) {
  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.depthsWager} Wager Result Recorded`);
  container.addTextDisplayComponents(titleText);

  const wName = wUser ? `<@${wUser.id}>` : `<@${winnerId}>`;
  const lName = lUser ? `<@${lUser.id}>` : `<@${loserId}>`;

  const streakInfo = winnerProfile.wagerWinStreak >= 3
    ? ` [🔥 ${winnerProfile.wagerWinStreak} win streak]`
    : '';

  // Use Section for Winner
  const winnerSection = new SectionBuilder();
  const winnerText = new TextDisplayBuilder()
    .setContent(
      '**🏆 Winner**\n' +
      `${wName}\n` +
      `**Record:** ${winnerProfile.wagerWins}W - ${winnerProfile.wagerLosses || 0}L${streakInfo}`
    );
  // Add trophy thumbnail if new win streak or just general winner vibe
  if (winnerProfile.wagerWinStreak >= 3) {
    winnerSection.setThumbnailAccessory(t => t.setURL('https://emojicdn.elk.sh/🔥?style=twitter').setDescription('Streak'));
  }
  winnerSection.addTextDisplayComponents(winnerText);
  container.addSectionComponents(winnerSection);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Use Section for Loser
  const loserSection = new SectionBuilder();
  const loserText = new TextDisplayBuilder()
    .setContent(
      '**💀 Loser**\n' +
      `${lName}\n` +
      `**Record:** ${loserProfile.wagerWins || 0}W - ${loserProfile.wagerLosses}L`
    );
  loserSection.addTextDisplayComponents(loserText);
  container.addSectionComponents(loserSection);

  container.addSeparatorComponents(new SeparatorBuilder());

  const infoText = new TextDisplayBuilder()
    .setContent(
      `**Recorded by:** <@${actorId}> • <t:${Math.floor(Date.now() / 1000)}:R>`
    );
  container.addTextDisplayComponents(infoText);

  return container;
}

/**
 * Build the 2v2 wager result container
 * @param {string} actorId
 * @param {string[]} winnerIds
 * @param {string[]} loserIds
 * @param {Object[]} winnerUsers Discord Users
 * @param {Object[]} loserUsers Discord Users
 * @param {Object[]} winnerProfiles
 * @param {Object[]} loserProfiles
 */
function buildWagerResult2v2Container(actorId, winnerIds, loserIds, winnerUsers, loserUsers, winnerProfiles, loserProfiles) {
  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.depthsWager} 2v2 Wager Result Recorded`);
  container.addTextDisplayComponents(titleText);

  // Build winner team info
  const w1Name = winnerUsers[0] ? `<@${winnerUsers[0].id}>` : `<@${winnerIds[0]}>`;
  const w2Name = winnerUsers[1] ? `<@${winnerUsers[1].id}>` : `<@${winnerIds[1]}>`;
  const maxStreak = Math.max(
    winnerProfiles[0].wagerWinStreak,
    winnerProfiles[1].wagerWinStreak
  );
  const streakInfo = maxStreak >= 3 ? ` [🔥 ${maxStreak} win streak]` : '';

  const winnerText = new TextDisplayBuilder()
    .setContent(
      '**🏆 Winning Team**\n' +
      `${w1Name} (${winnerProfiles[0].wagerWins}W-${winnerProfiles[0].wagerLosses || 0}L)\n` +
      `${w2Name} (${winnerProfiles[1].wagerWins}W-${winnerProfiles[1].wagerLosses || 0}L)` +
      streakInfo
    );

  const winnerSection = new SectionBuilder().addTextDisplayComponents(winnerText);
  container.addSectionComponents(winnerSection);

  container.addSeparatorComponents(new SeparatorBuilder());

  // Build loser team info
  const l1Name = loserUsers[0] ? `<@${loserUsers[0].id}>` : `<@${loserIds[0]}>`;
  const l2Name = loserUsers[1] ? `<@${loserUsers[1].id}>` : `<@${loserIds[1]}>`;

  const loserText = new TextDisplayBuilder()
    .setContent(
      '**💀 Losing Team**\n' +
      `${l1Name} (${loserProfiles[0].wagerWins || 0}W-${loserProfiles[0].wagerLosses}L)\n` +
      `${l2Name} (${loserProfiles[1].wagerWins || 0}W-${loserProfiles[1].wagerLosses}L)`
    );

  const loserSection = new SectionBuilder().addTextDisplayComponents(loserText);
  container.addSectionComponents(loserSection);

  container.addSeparatorComponents(new SeparatorBuilder());

  const infoText = new TextDisplayBuilder()
    .setContent(
      `**Type:** 2v2 Wager • **Recorded by:** <@${actorId}> • <t:${Math.floor(Date.now() / 1000)}:R>`
    );
  container.addTextDisplayComponents(infoText);

  return container;
}

module.exports = {
  buildWagerResultContainer,
  buildWagerResult2v2Container
};
