const ServerSettings = require('../../models/settings/ServerSettings');

/**
 * Busca ou cria a configuração do servidor
 */
async function getOrCreateServerSettings(discordGuildId) {
  try {
    let doc = await ServerSettings.findOne({ discordGuildId }).lean(false);
    if (!doc) {
      doc = await ServerSettings.create({ discordGuildId });
    }
    return doc;
  } catch (e) {
    // No DB connection or error: gracefully degrade with in-memory object
    return {
      discordGuildId,
      logsChannelId: null,
      leaderboardChannelId: null,
      leaderboardMessageId: null,
      wagerLeaderboardChannelId: null,
      wagerLeaderboardMessageId: null,
      eventPointsLeaderboardChannelId: null,
      eventPointsLeaderboardMessageId: null,
      warCategoryId: null,
      wagerCategoryId: null,
      generalTicketsCategoryId: null,
      warTicketsChannelId: null,
      wagerTicketsChannelId: null,
      generalTicketsChannelId: null,
      warDodgeChannelId: null,
      wagerDodgeChannelId: null,
      rosterForumChannelId: null,
      dmWarningChannelId: null,
      warLogsChannelId: null
    };
  }
}

async function setWarTicketsChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.warTicketsChannelId = channelId;
  await doc.save();
  return doc;
}

async function setRosterForumChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.rosterForumChannelId = channelId;
  await doc.save();
  return doc;
}

async function setLeaderboardChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.leaderboardChannelId = channelId;
  await doc.save();
  return doc;
}

async function setLeaderboardMessage(discordGuildId, messageId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.leaderboardMessageId = messageId;
  await doc.save();
  return doc;
}

async function setWagerTicketsChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.wagerTicketsChannelId = channelId;
  await doc.save();
  return doc;
}

async function setWarDodgeChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.warDodgeChannelId = channelId;
  await doc.save();
  return doc;
}

async function setWagerDodgeChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.wagerDodgeChannelId = channelId;
  await doc.save();
  return doc;
}

async function setDmWarningChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.dmWarningChannelId = channelId;
  await doc.save();
  return doc;
}

async function setGeneralTicketsChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.generalTicketsChannelId = channelId;
  await doc.save();
  return doc;
}

async function setGeneralTicketsCategory(discordGuildId, categoryId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.generalTicketsCategoryId = categoryId;
  await doc.save();
  return doc;
}

async function setWarLogsChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.warLogsChannelId = channelId;
  await doc.save();
  return doc;
}

async function setEventPointsLeaderboardChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.eventPointsLeaderboardChannelId = channelId;
  await doc.save();
  return doc;
}

async function setEventPointsLeaderboardMessage(discordGuildId, messageId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.eventPointsLeaderboardMessageId = messageId;
  await doc.save();
  return doc;
}

async function setWagerLeaderboardChannel(discordGuildId, channelId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.wagerLeaderboardChannelId = channelId;
  await doc.save();
  return doc;
}

async function setWagerLeaderboardMessage(discordGuildId, messageId) {
  const doc = await getOrCreateServerSettings(discordGuildId);
  doc.wagerLeaderboardMessageId = messageId;
  await doc.save();
  return doc;
}

module.exports = {
  getOrCreateServerSettings,
  setWarTicketsChannel,
  setWagerTicketsChannel,
  setRosterForumChannel,
  setLeaderboardChannel,
  setLeaderboardMessage,
  setWagerLeaderboardChannel,
  setWagerLeaderboardMessage,
  setWarDodgeChannel,
  setWagerDodgeChannel,
  setDmWarningChannel,
  setGeneralTicketsChannel,
  setGeneralTicketsCategory,
  setWarLogsChannel,
  setEventPointsLeaderboardChannel,
  setEventPointsLeaderboardMessage
};

