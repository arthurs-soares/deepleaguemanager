const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors } = require('../../config/botConfig');
const { createErrorEmbed } = require('../embeds/embedBuilder');
const { auditAdminAction } = require('../misc/adminAudit');
const { getOrCreateUserProfile } = require('../user/userProfile');
const { updateRanksAfterWager } = require('../../services/rankService');

/**
 * Helper to fetch a user from client
 * @param {import('discord.js').Client} client
 * @param {string} userId
 */
async function getUser(client, userId) {
  try { return await client.users.fetch(userId); } catch (_) { return null; }
}

/**
 * Record a wager result between two users and return a public container
 * @param {import('discord.js').Guild} discordGuild
 * @param {string} actorId
 * @param {string} winnerId
 * @param {string} loserId
 * @param {import('discord.js').Client} client
 */
async function recordWager(discordGuild, actorId, winnerId, loserId, client) {
  if (!winnerId || !loserId || winnerId === loserId) {
    return createErrorEmbed(
      'Invalid users',
      'Winner and loser must be different valid users.'
    );
  }

  // Update winner stats
  const winnerProfile = await getOrCreateUserProfile(winnerId);
  winnerProfile.wagerGamesPlayed = (winnerProfile.wagerGamesPlayed || 0) + 1;
  winnerProfile.wagerWins = (winnerProfile.wagerWins || 0) + 1;
  winnerProfile.wagerWinStreak = (winnerProfile.wagerWinStreak || 0) + 1;
  winnerProfile.wagerLossStreak = 0;
  if (winnerProfile.wagerWinStreak > (winnerProfile.wagerMaxWinStreak || 0)) {
    winnerProfile.wagerMaxWinStreak = winnerProfile.wagerWinStreak;
  }
  await winnerProfile.save();

  // Update loser stats
  const loserProfile = await getOrCreateUserProfile(loserId);
  loserProfile.wagerGamesPlayed = (loserProfile.wagerGamesPlayed || 0) + 1;
  loserProfile.wagerLosses = (loserProfile.wagerLosses || 0) + 1;
  loserProfile.wagerLossStreak = (loserProfile.wagerLossStreak || 0) + 1;
  loserProfile.wagerWinStreak = 0;
  await loserProfile.save();

  // Update rank roles based on new wager wins
  try {
    await updateRanksAfterWager(discordGuild, winnerId, winnerProfile.wagerWins);
  } catch (_) {}

  const wUser = await getUser(client, winnerId);
  const lUser = await getUser(client, loserId);

  try {
    await auditAdminAction(discordGuild, actorId, 'Wager Result Recorded', {
      targetUserId: winnerId,
      extra: `Winner: ${wUser?.tag || winnerId}, Loser: ${lUser?.tag || loserId}`
    });
  } catch (_) {}

  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent('# 🎲 Wager Result Recorded');

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

module.exports = { recordWager };
