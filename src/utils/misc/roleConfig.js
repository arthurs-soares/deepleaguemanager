const RoleConfig = require('../../models/settings/RoleConfig');
const { withDatabase } = require('../../config/database');

// Fallback object when DB is unavailable
function buildInMemoryDefault(discordGuildId) {
  return {
    discordGuildId,
    leadersRoleId: null,
    coLeadersRoleId: null,
    managersRoleId: null,
    moderatorsRoleIds: [],
    hostersRoleIds: [],
    supportRoleIds: [],
    adminSupportRoleIds: [],
    tagRoleId: null
  };
}

/**
 * Retrieve or create RoleConfig for a guild.
 * - Uses withDatabase() for graceful degradation when DB is offline.
 */
async function getOrCreateRoleConfig(discordGuildId) {
  try {
    const doc = await withDatabase(async () => {
      let d = await RoleConfig.findOne({ discordGuildId }).lean(false);
      if (!d) d = await RoleConfig.create({ discordGuildId });
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
 * Set a single role id value.
 * - Throws when DB is offline so callers can show an error.
 */
async function setSingle(discordGuildId, key, roleId) {
  const result = await withDatabase(async () => {
    let doc = await RoleConfig.findOne({ discordGuildId }).lean(false);
    if (!doc) doc = await RoleConfig.create({ discordGuildId });
    doc[key] = roleId || null;
    await doc.save();
    return doc;
  }, NO_DB);

  if (result === NO_DB) {
    throw new Error('Database not connected');
  }
  return result;
}

/**
 * Set multiple role ids.
 * - Throws when DB is offline so callers can show an error.
 */
async function setMulti(discordGuildId, key, roleIds) {
  const result = await withDatabase(async () => {
    let doc = await RoleConfig.findOne({ discordGuildId }).lean(false);
    if (!doc) doc = await RoleConfig.create({ discordGuildId });
    doc[key] = Array.isArray(roleIds) ? roleIds : [];
    await doc.save();
    return doc;
  }, NO_DB);

  if (result === NO_DB) {
    throw new Error('Database not connected');
  }
  return result;
}

module.exports = { getOrCreateRoleConfig, setSingle, setMulti };
