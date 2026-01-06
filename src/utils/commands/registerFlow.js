const { createErrorEmbed } = require('../embeds/embedBuilder');
const { ensureLeaderDiscordRole } = require('../user/leaderRoleAssigner');

const VALID_REGIONS = ['Europe', 'South America', 'NA East', 'NA West', 'Asia'];

/**
 * Parse extra regions string into array
 * @param {string|null} extraRegionsStr - Comma-separated regions
 * @returns {string[]} Valid unique regions
 */
function parseExtraRegions(extraRegionsStr) {
  if (!extraRegionsStr) return [];

  return extraRegionsStr
    .split(',')
    .map(r => r.trim())
    .filter(r => VALID_REGIONS.includes(r));
}

/**
 * Validate inputs for /register command
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @returns {{ok: true} | {ok: false, container: any}}
 */
function validateRegisterInputs(interaction) {
  const name = interaction.options.getString('name');
  const leaderUser = interaction.options.getUser('leader');
  const region = interaction.options.getString('region');
  const extraRegionsStr = interaction.options.getString('extra_regions');

  if (!name || name.trim().length === 0) {
    return {
      ok: false,
      container: createErrorEmbed('Invalid Name', 'Guild name cannot be empty.')
    };
  }

  if (!leaderUser) {
    return {
      ok: false,
      container: createErrorEmbed(
        'Invalid Leader',
        'You need to select a valid user as leader.'
      )
    };
  }

  if (!region) {
    return {
      ok: false,
      container: createErrorEmbed(
        'Invalid Region',
        'You need to select a valid region.'
      )
    };
  }

  // Validate extra regions if provided
  if (extraRegionsStr) {
    const inputParts = extraRegionsStr.split(',').map(r => r.trim());
    const invalidRegions = inputParts.filter(r => !VALID_REGIONS.includes(r));

    if (invalidRegions.length > 0) {
      return {
        ok: false,
        container: createErrorEmbed(
          'Invalid Extra Regions',
          `Invalid regions: ${invalidRegions.join(', ')}\n` +
          `Valid options: ${VALID_REGIONS.join(', ')}`
        )
      };
    }
  }

  return { ok: true };
}

/**
 * Build guild registration payload from interaction
 */
function buildGuildRegistrationData(interaction) {
  const name = interaction.options.getString('name');
  const leaderUser = interaction.options.getUser('leader');
  const region = interaction.options.getString('region');
  const extraRegionsStr = interaction.options.getString('extra_regions');

  // Use Discord server icon as default guild icon
  const serverIconUrl = interaction.guild.iconURL({
    dynamic: true,
    size: 256
  });

  // Parse extra regions and combine with primary region
  const extraRegions = parseExtraRegions(extraRegionsStr);
  const allRegions = [region, ...extraRegions.filter(r => r !== region)];
  const uniqueRegions = [...new Set(allRegions)];

  return {
    name,
    leader: leaderUser.username,
    leaderId: leaderUser.id,
    registeredBy: interaction.user.id,
    discordGuildId: interaction.guild.id,
    region,
    regions: uniqueRegions,
    iconUrl: serverIconUrl || null
  };
}

/**
 * Post-processing after successful registration:
 * - Log event (best-effort)
 * - Ensure Leader role assignment
 */
async function postRegistration(interaction, guild, leaderUserId) {
  try {
    const { logGuildRegistered } = require('../misc/logEvents');
    await logGuildRegistered(guild, interaction.guild, interaction.user.id);
  } catch (_) { }

  try {
    await ensureLeaderDiscordRole(interaction.guild, leaderUserId);
  } catch (_) { }
}

module.exports = {
  validateRegisterInputs,
  buildGuildRegistrationData,
  postRegistration,
};

