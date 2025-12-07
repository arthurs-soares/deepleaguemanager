/**
 * Get region data from a guild document
 * @param {Object} doc - Guild document
 * @param {string} region - Region name
 * @returns {Object|null} Region data or null if not found
 */
function getRegionData(doc, region) {
  if (!Array.isArray(doc.regions)) return null;
  return doc.regions.find(r => r.region === region) || null;
}

/**
 * Get rosters for a specific region (with fallback to legacy global)
 * @param {Object} doc - Guild document
 * @param {string} region - Region name
 * @returns {{mainRoster: string[], subRoster: string[]}}
 */
function getRegionRosters(doc, region) {
  const legacyMain = Array.isArray(doc.mainRoster) ? doc.mainRoster : [];
  const legacySub = Array.isArray(doc.subRoster) ? doc.subRoster : [];
  const regionData = getRegionData(doc, region);
  if (regionData) {
    const regionMain = Array.isArray(regionData.mainRoster)
      ? regionData.mainRoster : [];
    const regionSub = Array.isArray(regionData.subRoster)
      ? regionData.subRoster : [];
    return {
      mainRoster: regionMain.length > 0 ? regionMain : legacyMain,
      subRoster: regionSub.length > 0 ? regionSub : legacySub
    };
  }
  return { mainRoster: legacyMain, subRoster: legacySub };
}

/**
 * Check if user is in any roster of a specific region
 * @param {Object} doc - Guild document
 * @param {string} region - Region name
 * @param {string} userId - Discord user ID
 * @returns {boolean}
 */
function isUserInRegionRoster(doc, region, userId) {
  const { mainRoster, subRoster } = getRegionRosters(doc, region);
  return mainRoster.includes(userId) || subRoster.includes(userId);
}

/**
 * Check if user is in any roster of any region of this guild
 * @param {Object} doc - Guild document
 * @param {string} userId - Discord user ID
 * @returns {{inRoster: boolean, regions: string[]}}
 */
function isUserInAnyGuildRoster(doc, userId) {
  const regions = [];
  if (Array.isArray(doc.regions)) {
    for (const r of doc.regions) {
      const main = Array.isArray(r.mainRoster) ? r.mainRoster : [];
      const sub = Array.isArray(r.subRoster) ? r.subRoster : [];
      if (main.includes(userId) || sub.includes(userId)) {
        regions.push(r.region);
      }
    }
  }
  const legacyMain = Array.isArray(doc.mainRoster) ? doc.mainRoster : [];
  const legacySub = Array.isArray(doc.subRoster) ? doc.subRoster : [];
  if (legacyMain.includes(userId) || legacySub.includes(userId)) {
    if (!regions.includes('legacy')) regions.push('legacy');
  }
  return { inRoster: regions.length > 0, regions };
}

/**
 * Get all unique roster members across all regions
 * @param {Object} doc - Guild document
 * @returns {{allMain: string[], allSub: string[], allUnique: string[]}}
 */
function getAllRosterMembers(doc) {
  const allMain = new Set();
  const allSub = new Set();
  if (Array.isArray(doc.regions)) {
    for (const r of doc.regions) {
      const main = Array.isArray(r.mainRoster) ? r.mainRoster : [];
      const sub = Array.isArray(r.subRoster) ? r.subRoster : [];
      main.forEach(id => allMain.add(id));
      sub.forEach(id => allSub.add(id));
    }
  }
  const legacyMain = Array.isArray(doc.mainRoster) ? doc.mainRoster : [];
  const legacySub = Array.isArray(doc.subRoster) ? doc.subRoster : [];
  legacyMain.forEach(id => allMain.add(id));
  legacySub.forEach(id => allSub.add(id));
  const allUnique = new Set([...allMain, ...allSub]);
  return {
    allMain: [...allMain],
    allSub: [...allSub],
    allUnique: [...allUnique]
  };
}

module.exports = {
  getRegionData,
  getRegionRosters,
  isUserInRegionRoster,
  isUserInAnyGuildRoster,
  getAllRosterMembers
};
