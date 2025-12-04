const RankConfig = require('../../models/settings/RankConfig');
const { withDatabase } = require('../../config/database');

// Fallback object when DB is unavailable
function buildInMemoryDefault(discordGuildId) {
  return {
    discordGuildId,
    iron1RoleId: null,
    iron2RoleId: null,
    iron3RoleId: null,
    silver1RoleId: null,
    silver2RoleId: null,
    silver3RoleId: null,
    gold1RoleId: null,
    gold2RoleId: null,
    gold3RoleId: null,
    platinum1RoleId: null,
    platinum2RoleId: null,
    platinum3RoleId: null,
    diamond1RoleId: null,
    diamond2RoleId: null,
    masterRoleId: null,
    grandMasterRoleId: null,
    top10RoleId: null
  };
}

/**
 * Rank definitions with their required wins
 */
const RANK_DEFINITIONS = {
  iron1: { name: 'Iron 1', wins: 2, emoji: '🔩' },
  iron2: { name: 'Iron 2', wins: 4, emoji: '🔩' },
  iron3: { name: 'Iron 3', wins: 6, emoji: '🔩' },
  silver1: { name: 'Silver 1', wins: 8, emoji: '🥈' },
  silver2: { name: 'Silver 2', wins: 10, emoji: '🥈' },
  silver3: { name: 'Silver 3', wins: 12, emoji: '🥈' },
  gold1: { name: 'Gold 1', wins: 14, emoji: '🥇' },
  gold2: { name: 'Gold 2', wins: 16, emoji: '🥇' },
  gold3: { name: 'Gold 3', wins: 18, emoji: '🥇' },
  platinum1: { name: 'Platinum 1', wins: 20, emoji: '💎' },
  platinum2: { name: 'Platinum 2', wins: 22, emoji: '💎' },
  platinum3: { name: 'Platinum 3', wins: 24, emoji: '💎' },
  diamond1: { name: 'Diamond 1', wins: 26, emoji: '💠' },
  diamond2: { name: 'Diamond 2', wins: 28, emoji: '💠' },
  master: { name: 'Master', wins: 30, emoji: '👑' },
  grandMaster: { name: 'Grand Master', wins: 35, emoji: '🏆' },
  top10: { name: 'Top 10', wins: 'Top 10', emoji: '⭐' }
};

/**
 * Get rank key from role field name
 */
function getRankKeyFromField(fieldName) {
  return fieldName.replace('RoleId', '');
}

/**
 * Get role field name from rank key
 */
function getFieldFromRankKey(rankKey) {
  return `${rankKey}RoleId`;
}

/**
 * Retrieve or create RankConfig for a guild.
 * - Uses withDatabase() for graceful degradation when DB is offline.
 */
async function getOrCreateRankConfig(discordGuildId) {
  try {
    const doc = await withDatabase(async () => {
      let d = await RankConfig.findOne({ discordGuildId }).lean(false);
      if (!d) d = await RankConfig.create({ discordGuildId });
      return d;
    }, null);

    return doc || buildInMemoryDefault(discordGuildId);
  } catch (_) {
    // Degrade to in-memory defaults when DB is not reachable
    return buildInMemoryDefault(discordGuildId);
  }
}

// Special token to detect offline DB from withDatabase fallback
const NO_DB = Symbol('NO_DB');

/**
 * Set a rank role id.
 * - Throws when DB is offline so callers can show an error.
 * @param {string} discordGuildId - Guild ID
 * @param {string} rankKey - Rank key (e.g., 'iron1', 'silver2', 'master')
 * @param {string|null} roleId - Role ID to set
 */
async function setRankRole(discordGuildId, rankKey, roleId) {
  const fieldName = getFieldFromRankKey(rankKey);

  const result = await withDatabase(async () => {
    let doc = await RankConfig.findOne({ discordGuildId }).lean(false);
    if (!doc) doc = await RankConfig.create({ discordGuildId });
    doc[fieldName] = roleId || null;
    await doc.save();
    return doc;
  }, NO_DB);

  if (result === NO_DB) {
    throw new Error('Database not connected');
  }
  return result;
}

/**
 * Build display text for ranks configuration
 * @param {Object} cfg - RankConfig document
 * @returns {string}
 */
function buildRanksDisplayText(cfg) {
  const lines = ['**Ranks Configuration**\n'];

  // Group ranks by tier
  const tiers = [
    { name: '🔩 Iron', ranks: ['iron1', 'iron2', 'iron3'] },
    { name: '🥈 Silver', ranks: ['silver1', 'silver2', 'silver3'] },
    { name: '🥇 Gold', ranks: ['gold1', 'gold2', 'gold3'] },
    { name: '💎 Platinum', ranks: ['platinum1', 'platinum2', 'platinum3'] },
    { name: '💠 Diamond', ranks: ['diamond1', 'diamond2'] },
    { name: '👑 High Elo', ranks: ['master', 'grandMaster', 'top10'] }
  ];

  for (const tier of tiers) {
    const tierRanks = tier.ranks.map(rankKey => {
      const def = RANK_DEFINITIONS[rankKey];
      const fieldName = getFieldFromRankKey(rankKey);
      const roleId = cfg[fieldName];
      const winsText = rankKey === 'top10' ? 'Top 10' : `${def.wins} Wins`;
      return `${def.name} (${winsText}): ${roleId ? `<@&${roleId}>` : '—'}`;
    });
    lines.push(`**${tier.name}**\n${tierRanks.join('\n')}\n`);
  }

  return lines.join('\n');
}

module.exports = {
  getOrCreateRankConfig,
  setRankRole,
  buildRanksDisplayText,
  RANK_DEFINITIONS,
  getRankKeyFromField,
  getFieldFromRankKey
};
