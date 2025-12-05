/**
 * Shared utilities for guild display components
 * Provides helper functions for building guild embeds and panels
 */
const {
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ActionRowBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const { getFirstActiveRegion } = require('../../models/statics/guildStatics');
const { emojis } = require('../../config/botConfig');

/**
 * Get region stats for display
 * @param {Object} guild - Guild document
 * @param {string} selectedRegion - Selected region name
 * @returns {Object} Region stats
 */
function getRegionStatsForDisplay(guild, selectedRegion) {
  if (!guild?.regions?.length) {
    return { region: '—', wins: 0, losses: 0, elo: 1000 };
  }

  if (selectedRegion) {
    const found = guild.regions.find(r => r.region === selectedRegion);
    if (found) return found;
  }

  return getFirstActiveRegion(guild) || guild.regions[0];
}

/**
 * Format a list of user IDs as mentions
 * @param {string[]} ids - Array of user IDs
 * @returns {string} Formatted list
 */
function formatUserList(ids) {
  if (!ids || ids.length === 0) return '—';
  const items = ids.map(id => `<@${id}>`);
  const text = items.join('\n');
  return text.length > 1000 ? text.slice(0, 1000) + '…' : text;
}

/**
 * Format managers list for display (comma-separated)
 * @param {string[]} managers - Array of manager user IDs
 * @returns {string}
 */
function formatManagersList(managers) {
  if (!Array.isArray(managers) || managers.length === 0) return '—';
  return managers.map(id => `<@${id}>`).join(', ');
}

/**
 * Build region stats text display
 * @param {Object} regionStats - Region stats object
 * @param {Array} activeRegions - Active regions array
 * @param {boolean} useH3 - Use H3 header style
 * @returns {TextDisplayBuilder}
 */
function buildRegionStatsText(regionStats, activeRegions, useH3 = false) {
  const regionLabel = regionStats?.region || '—';
  const regionWins = regionStats?.wins ?? 0;
  const regionLosses = regionStats?.losses ?? 0;
  const regionElo = regionStats?.elo ?? 1000;

  const regionsListText = activeRegions.length > 0
    ? activeRegions.map(r => r.region).join(', ')
    : '—';

  const header = useH3
    ? `### 🌍 Region Stats: **${regionLabel}**`
    : `**${emojis.region} Region Stats: ${regionLabel}**`;

  return new TextDisplayBuilder().setContent(
    `${header}\n` +
    `**Regions:** ${regionsListText}\n` +
    `**${emojis.winsLosses} W/L:** ${regionWins}/${regionLosses} | **ELO:** ${regionElo}`
  );
}

/**
 * Build region selector component
 * @param {string} customIdPrefix - Prefix for customId (e.g., 'guild_view', 'guild_panel')
 * @param {string} guildId - Guild ID
 * @param {Array} activeRegions - Active regions array
 * @param {string} currentRegion - Currently selected region
 * @returns {ActionRowBuilder|null} Action row or null if < 2 regions
 */
function buildRegionSelector(customIdPrefix, guildId, activeRegions, currentRegion) {
  if (!activeRegions || activeRegions.length < 2 || !guildId) return null;

  const regionSelect = new StringSelectMenuBuilder()
    .setCustomId(`${customIdPrefix}:select_region:${guildId}`)
    .setPlaceholder('Switch Region');

  for (const r of activeRegions) {
    const option = new StringSelectMenuOptionBuilder()
      .setLabel(r.region)
      .setValue(r.region)
      .setDefault(r.region === currentRegion);
    regionSelect.addOptions(option);
  }

  return new ActionRowBuilder().addComponents(regionSelect);
}

module.exports = {
  getRegionStatsForDisplay,
  formatUserList,
  formatManagersList,
  buildRegionStatsText,
  buildRegionSelector
};
