// War scheduling validation utilities
const { ChannelType } = require('discord.js');


/**
 * Validate date and time input
 * @param {string} date - Date string
 * @param {string} time - Time string
 * @returns {Object} Validation result with parsed datetime or error
 */
function validateDateTime(date, time) {
  const dateTime = new Date(`${date}T${time}:00Z`);

  if (isNaN(dateTime.getTime())) {
    return {
      valid: false,
      message: '❌ Invalid date/time format.'
    };
  }

  return {
    valid: true,
    dateTime
  };
}

/**
 * Validate guild documents
 * @param {Object} guildA - Guild A document
 * @param {Object} guildB - Guild B document
 * @returns {Object} Validation result
 */
function validateGuilds(guildA, guildB) {
  if (!guildA || !guildB) {
    return {
      valid: false,
      message: '❌ Invalid guilds.'
    };
  }

  return { valid: true };
}

/**
 * Map region name to settings field
 * @param {string} region - Guild region
 * @returns {string} Settings field name
 */
function getRegionCategoryField(region) {
  const regionMap = {
    'South America': 'warCategorySAId',
    'NA East': 'warCategoryNAEId',
    'NA West': 'warCategoryNAWId',
    'Europe': 'warCategoryEUId',
    'Asia': 'warCategoryAsiaId'
  };
  return regionMap[region] || null;
}

/**
 * Get region display name for error messages
 * @param {string} region - Guild region
 * @returns {string} Display name
 */
function getRegionDisplayName(region) {
  const displayMap = {
    'South America': 'SA',
    'NA East': 'NAE',
    'NA West': 'NAW',
    'Europe': 'EU',
    'Asia': 'Asia'
  };
  return displayMap[region] || region;
}

/**
 * Validate war category configuration by region
 * @param {Object} settings - Server settings
 * @param {Object} guild - Discord guild
 * @param {string} region - Guild region for category selection
 * @returns {Object} Validation result
 */
async function validateWarCategory(settings, guild, region) {
  const categoryField = getRegionCategoryField(region);
  const regionDisplay = getRegionDisplayName(region);

  if (!categoryField) {
    return {
      valid: false,
      message: `❌ Invalid region: ${region}`
    };
  }

  const categoryId = settings[categoryField];
  if (!categoryId) {
    return {
      valid: false,
      message: `❌ War category for **${regionDisplay}** not configured. ` +
        `Use /config → Channels → Set War Category (${regionDisplay}).`
    };
  }

  let category = guild.channels.cache.get(categoryId);
  if (!category) {
    try {
      category = await guild.channels.fetch(categoryId);
    } catch (_) {
      // ignore fetch errors; will be handled by the type check below
    }
  }

  if (!category || category.type !== ChannelType.GuildCategory) {
    return {
      valid: false,
      message: `❌ War category for **${regionDisplay}** not configured. ` +
        `Use /config → Channels → Set War Category (${regionDisplay}).`
    };
  }

  return {
    valid: true,
    category
  };
}

/**
 * Validate separate day/month/year and time, ensuring future date
 * @param {string|number} day
 * @param {string|number} month
 * @param {string|number} year
 * @param {string} time - HH:mm (24-hour)
 * @returns {{valid: boolean, dateTime?: Date, message?: string}}
 */
function validateDateParts(day, month, year, time) {
  const dd = parseInt(String(day || '').trim(), 10);
  const mm = parseInt(String(month || '').trim(), 10);
  const yyyy = parseInt(String(year || '').trim(), 10);
  if (!Number.isInteger(dd) || dd < 1 || dd > 31) {
    return { valid: false, message: '❌ Day must be a number between 1 and 31.' };
  }
  if (!Number.isInteger(mm) || mm < 1 || mm > 12) {
    return { valid: false, message: '❌ Month must be a number between 1 and 12.' };
  }
  if (!Number.isInteger(yyyy) || String(yyyy).length !== 4) {
    return { valid: false, message: '❌ Year must be a 4-digit number.' };
  }

  const timeStr = String(time || '').trim();
  const m = timeStr.match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
  if (!m) {
    return { valid: false, message: '❌ Time must be in HH:mm (24-hour) format.' };
  }
  const hours = parseInt(m[1], 10);
  const minutes = parseInt(m[2], 10);

  // Build UTC datetime and validate parts (handles leap years and month length)
  const ms = Date.UTC(yyyy, mm - 1, dd, hours, minutes, 0);
  const dt = new Date(ms);
  if (
    dt.getUTCFullYear() !== yyyy ||
    dt.getUTCMonth() + 1 !== mm ||
    dt.getUTCDate() !== dd ||
    dt.getUTCHours() !== hours ||
    dt.getUTCMinutes() !== minutes
  ) {
    return { valid: false, message: '❌ Invalid date/time combination.' };
  }

  if (dt.getTime() <= Date.now()) {
    return { valid: false, message: '❌ The selected date/time must be in the future.' };
  }

  return { valid: true, dateTime: dt };
}

module.exports = {
  validateDateTime,
  validateGuilds,
  validateWarCategory,
  validateDateParts
};
