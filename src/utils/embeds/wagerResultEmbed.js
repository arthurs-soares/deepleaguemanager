const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
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

  const wName = wUser ? `<@${wUser.id}>` : `<@${winnerId}>`;
  const lName = lUser ? `<@${lUser.id}>` : `<@${loserId}>`;

  const streakInfo = winnerProfile.wagerWinStreak >= 3
    ? ` [🔥 ${winnerProfile.wagerWinStreak} win streak]`
    : '';

  const winnerText = new TextDisplayBuilder()
    .setContent(
      '**🏆 Winner**\n' +
            `${wName}\n` +
            `Record: **${winnerProfile.wagerWins}W/${winnerProfile.wagerLosses || 0}L**${streakInfo}`
    );

  const loserText = new TextDisplayBuilder()
    .setContent(
      '**💀 Loser**\n' +
            `${lName}\n` +
            `Record: **${loserProfile.wagerWins || 0}W/${loserProfile.wagerLosses}L**`
    );

  const typeText = new TextDisplayBuilder()
    .setContent(
      '**⚔️ Match Info**\n' +
            `Recorded by: <@${actorId}>`
    );

  const timestampText = new TextDisplayBuilder()
    .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

  container.addTextDisplayComponents(
    titleText,
    winnerText,
    loserText,
    typeText
  );
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(timestampText);

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
            `${w1Name} (${winnerProfiles[0].wagerWins}W/${winnerProfiles[0].wagerLosses || 0}L)\n` +
            `${w2Name} (${winnerProfiles[1].wagerWins}W/${winnerProfiles[1].wagerLosses || 0}L)` +
            streakInfo
    );

  // Build loser team info
  const l1Name = loserUsers[0] ? `<@${loserUsers[0].id}>` : `<@${loserIds[0]}>`;
  const l2Name = loserUsers[1] ? `<@${loserUsers[1].id}>` : `<@${loserIds[1]}>`;

  const loserText = new TextDisplayBuilder()
    .setContent(
      '**💀 Losing Team**\n' +
            `${l1Name} (${loserProfiles[0].wagerWins || 0}W/${loserProfiles[0].wagerLosses}L)\n` +
            `${l2Name} (${loserProfiles[1].wagerWins || 0}W/${loserProfiles[1].wagerLosses}L)`
    );

  const typeText = new TextDisplayBuilder()
    .setContent(
      '**⚔️ Match Info**\n' +
            `Type: 2v2 Wager\n` +
            `Recorded by: <@${actorId}>`
    );

  const timestampText = new TextDisplayBuilder()
    .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

  container.addTextDisplayComponents(titleText, winnerText, loserText, typeText);
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(timestampText);

  return container;
}

module.exports = {
  buildWagerResultContainer,
  buildWagerResult2v2Container
};
