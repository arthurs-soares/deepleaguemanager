const { removeFromRoster } = require('../roster/rosterManager');
const {
  notifyLeaderOnMemberLeave
} = require('../roster/notifyLeaderOnMemberLeave');
const {
  recordGuildLeave
} = require('../rate-limiting/guildTransitionCooldown');

/**
 * Leave from a specific region only
 * @param {Object} params - Parameters
 * @param {Object} params.doc - Guild document
 * @param {string} params.userId - User ID
 * @param {string} params.region - Region to leave
 * @param {string|null} params.leaderId - Leader ID for notification
 * @param {string} params.leaverUsername - Username of leaver
 * @param {Date} params.when - Timestamp
 * @param {Object} params.client - Discord client
 * @param {string} params.discordGuildId - Discord server ID
 * @returns {Promise<{success:boolean,message:string,stillInGuild:boolean}>}
 */
async function leaveFromRegion({
  doc,
  userId,
  region,
  leaderId,
  leaverUsername,
  when,
  client,
  discordGuildId
}) {
  const regionData = doc.regions?.find(r => r.region === region);
  if (!regionData) {
    return {
      success: false,
      message: `Guild is not registered in "${region}".`,
      stillInGuild: true
    };
  }

  const mainRoster = Array.isArray(regionData.mainRoster)
    ? regionData.mainRoster : [];
  const subRoster = Array.isArray(regionData.subRoster)
    ? regionData.subRoster : [];
  const wasInMain = mainRoster.includes(userId);
  const wasInSub = subRoster.includes(userId);

  if (!wasInMain && !wasInSub) {
    return {
      success: false,
      message: `You are not in any roster for "${region}".`,
      stillInGuild: true
    };
  }

  if (wasInMain) {
    await removeFromRoster(String(doc._id), 'main', userId, region)
      .catch(() => {});
  }
  if (wasInSub) {
    await removeFromRoster(String(doc._id), 'sub', userId, region)
      .catch(() => {});
  }

  if (leaderId) {
    await notifyLeaveToLeader({
      client,
      leaderId,
      userId,
      leaverUsername,
      guildName: doc.name,
      region,
      wasInMain,
      wasInSub,
      when
    });
  }

  const stillInOtherRegion = doc.regions?.some(r => {
    if (r.region === region) return false;
    const m = Array.isArray(r.mainRoster) ? r.mainRoster : [];
    const s = Array.isArray(r.subRoster) ? r.subRoster : [];
    return m.includes(userId) || s.includes(userId);
  });

  if (!stillInOtherRegion) {
    doc.members = (doc.members || []).filter(m => m.userId !== userId);
    await doc.save();

    try {
      await recordGuildLeave(discordGuildId, userId, String(doc._id), when);
    } catch (_) {}
  }

  return {
    success: true,
    message: `You left the **${region}** roster.`,
    stillInGuild: stillInOtherRegion
  };
}

/**
 * Leave from all regions
 * @param {Object} params - Parameters
 * @returns {Promise<{success:boolean,message:string}>}
 */
async function leaveFromAllRegions({
  doc,
  userId,
  members,
  leaderId,
  leaverUsername,
  when,
  client,
  discordGuildId
}) {
  doc.members = members.filter(m => m.userId !== userId);
  await doc.save();

  for (const r of doc.regions || []) {
    const main = Array.isArray(r.mainRoster) ? r.mainRoster : [];
    const sub = Array.isArray(r.subRoster) ? r.subRoster : [];
    const wasInMain = main.includes(userId);
    const wasInSub = sub.includes(userId);

    if (wasInMain) {
      await removeFromRoster(String(doc._id), 'main', userId, r.region)
        .catch(() => {});
    }
    if (wasInSub) {
      await removeFromRoster(String(doc._id), 'sub', userId, r.region)
        .catch(() => {});
    }

    if (leaderId && (wasInMain || wasInSub)) {
      await notifyLeaveToLeader({
        client,
        leaderId,
        userId,
        leaverUsername,
        guildName: doc.name,
        region: r.region,
        wasInMain,
        wasInSub,
        when
      });
    }
  }

  try {
    await recordGuildLeave(discordGuildId, userId, String(doc._id), when);
  } catch (_) {}

  return { success: true, message: 'You have successfully left your guild.' };
}

/**
 * Notify leader about member leaving
 */
async function notifyLeaveToLeader({
  client,
  leaderId,
  userId,
  leaverUsername,
  guildName,
  region,
  wasInMain,
  wasInSub,
  when
}) {
  if (wasInMain) {
    await notifyLeaderOnMemberLeave(client, leaderId, {
      leaverUserId: userId,
      leaverUsername,
      guildName,
      roster: `main (${region})`,
      when,
    }).catch(() => {});
  }
  if (wasInSub) {
    await notifyLeaderOnMemberLeave(client, leaderId, {
      leaverUserId: userId,
      leaverUsername,
      guildName,
      roster: `sub (${region})`,
      when,
    }).catch(() => {});
  }
}

module.exports = {
  leaveFromRegion,
  leaveFromAllRegions
};
