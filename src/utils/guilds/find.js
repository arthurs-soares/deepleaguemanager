const mongoose = require('mongoose');
const Guild = require('../../models/guild/Guild');

function isMongoConnected() {
  return mongoose.connection.readyState === 1;
}

async function findGuildByName(name, discordGuildId) {
  try {
    return await Guild.findByName(name, discordGuildId);
  } catch (e) {
    return null;
  }
}

/**
 * Find guilds where user is leader, co-leader, or manager
 * @param {string} userId - Discord user ID
 * @param {string} discordGuildId - Discord server ID
 * @returns {Promise<Array>}
 */
async function findGuildsByUser(userId, discordGuildId) {
  if (!isMongoConnected()) return [];
  return Guild.find({
    discordGuildId,
    $or: [
      { members: { $elemMatch: { userId, role: { $in: ['lider', 'vice-lider'] } } } },
      { managers: userId }
    ]
  }).sort({ createdAt: -1 });
}

module.exports = { findGuildByName, findGuildsByUser };

