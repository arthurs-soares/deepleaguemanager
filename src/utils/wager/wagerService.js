const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
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
 * Record a 2v2 wager result and return a public container
 * @param {import('discord.js').Guild} discordGuild
 * @param {string} actorId
 * @param {string[]} winnerIds - Array of 2 winner user IDs
 * @param {string[]} loserIds - Array of 2 loser user IDs
 * @param {import('discord.js').Client} client
 */
async function recordWager2v2(
  discordGuild,
  actorId,
  winnerIds,
  loserIds,
  client
) {
  if (
    !winnerIds?.length ||
    !loserIds?.length ||
    winnerIds.length !== 2 ||
    loserIds.length !== 2
  ) {
    return createErrorEmbed(
      'Invalid teams',
      'Both teams must have exactly 2 players.'
    );
  }

  // Check for duplicate users
  const allIds = [...winnerIds, ...loserIds];
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== 4) {
    return createErrorEmbed(
      'Invalid participants',
      'All 4 participants must be unique users.'
    );
  }

  // Update stats for both winners
  const winnerProfiles = [];
  for (const winnerId of winnerIds) {
    const profile = await getOrCreateUserProfile(winnerId);
    profile.wagerGamesPlayed = (profile.wagerGamesPlayed || 0) + 1;
    profile.wagerWins = (profile.wagerWins || 0) + 1;
    profile.wagerWinStreak = (profile.wagerWinStreak || 0) + 1;
    profile.wagerLossStreak = 0;
    if (profile.wagerWinStreak > (profile.wagerMaxWinStreak || 0)) {
      profile.wagerMaxWinStreak = profile.wagerWinStreak;
    }
    await profile.save();
    winnerProfiles.push(profile);

    // Update rank roles
    try {
      await updateRanksAfterWager(discordGuild, winnerId, profile.wagerWins);
    } catch (_) {}
  }

  // Update stats for both losers
  const loserProfiles = [];
  for (const loserId of loserIds) {
    const profile = await getOrCreateUserProfile(loserId);
    profile.wagerGamesPlayed = (profile.wagerGamesPlayed || 0) + 1;
    profile.wagerLosses = (profile.wagerLosses || 0) + 1;
    profile.wagerLossStreak = (profile.wagerLossStreak || 0) + 1;
    profile.wagerWinStreak = 0;
    await profile.save();
    loserProfiles.push(profile);
  }

  // Fetch users
  const [winner1, winner2, loser1, loser2] = await Promise.all([
    getUser(client, winnerIds[0]),
    getUser(client, winnerIds[1]),
    getUser(client, loserIds[0]),
    getUser(client, loserIds[1])
  ]);

  // Audit log
  try {
    await auditAdminAction(discordGuild, actorId, '2v2 Wager Result Recorded', {
      targetUserId: winnerIds[0],
      extra: `Winners: ${winner1?.tag || winnerIds[0]} & ${winner2?.tag || winnerIds[1]}, ` +
        `Losers: ${loser1?.tag || loserIds[0]} & ${loser2?.tag || loserIds[1]}`
    });
  } catch (_) {}

  // Build result container
  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.depthsWager} 2v2 Wager Result Recorded`);

  // Build winner team info
  const w1Name = winner1 ? `<@${winner1.id}>` : `<@${winnerIds[0]}>`;
  const w2Name = winner2 ? `<@${winner2.id}>` : `<@${winnerIds[1]}>`;
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
  const l1Name = loser1 ? `<@${loser1.id}>` : `<@${loserIds[0]}>`;
  const l2Name = loser2 ? `<@${loser2.id}>` : `<@${loserIds[1]}>`;

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

module.exports = { recordWager, recordWager2v2 };
