const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const { normalizeRoleToPortuguese } = require('../core/roleMapping');
const {
  getRegionStatsForDisplay,
  formatUserList,
  buildRegionStatsText,
  buildRegionSelector
} = require('./guildDisplayHelpers');


/**
 * Build guild details using Display Components v2
 * - Uses ContainerBuilder for main layout
 * - Uses SectionBuilder for organized information display
 * - Includes all existing functionality with modern components
 * @param {Object} guild - Guild document
 * @param {import('discord.js').Guild} _discordGuild - Discord guild object
 * @param {string} [selectedRegion] - Selected region for stats display
 * @returns {Promise<ContainerBuilder>}
 */
async function buildGuildDetailDisplayComponents(guild, _discordGuild, selectedRegion = null) {

  const members = Array.isArray(guild.members) ? guild.members : [];
  const leaderMember = members.find(m => normalizeRoleToPortuguese(m.role) === 'lider');
  const coLeader = members.find(m => normalizeRoleToPortuguese(m.role) === 'vice-lider');
  const mainRoster = Array.isArray(guild.mainRoster) ? guild.mainRoster : [];
  const subRoster = Array.isArray(guild.subRoster) ? guild.subRoster : [];
  const managers = Array.isArray(guild.managers) ? guild.managers : [];

  const guildId = guild.id || guild._id;
  const regionStats = getRegionStatsForDisplay(guild, selectedRegion);
  const activeRegions = (guild.regions || []).filter(r => r.status === 'active');

  const color = guild.color ? parseInt(guild.color.replace('#', ''), 16) : colors.primary;

  // Create main container
  const container = new ContainerBuilder()
    .setAccentColor(color);

  // Header section with guild name and description
  const headerText = new TextDisplayBuilder()
    .setContent(`# ${emojis.leader} ${guild.name}`);

  container.addTextDisplayComponents(headerText);

  // Add description if available
  if (guild.description && String(guild.description).trim().length > 0) {
    const descriptionText = new TextDisplayBuilder()
      .setContent(String(guild.description));
    container.addTextDisplayComponents(descriptionText);
  }

  // Leadership section
  const leaderText = new TextDisplayBuilder()
    .setContent(`**${emojis.leader} Leader**\n${leaderMember?.userId ? `<@${leaderMember.userId}>` : (guild.leader || '—')}`);
  const coLeaderText = new TextDisplayBuilder()
    .setContent(`**${emojis.coLeader} Co-leader**\n${coLeader?.userId ? `<@${coLeader.userId}>` : (coLeader?.username || '—')}`);

  const leadershipSection = new SectionBuilder()
    .addTextDisplayComponents(leaderText, coLeaderText);

  // SectionBuilder requires an accessory; use iconUrl for thumbnail
  // Fallback to Discord server icon if no guild icon is set
  const serverIconUrl = _discordGuild?.iconURL({ dynamic: true, size: 128 });
  const accessoryThumbnailUrl = guild.iconUrl ||
    serverIconUrl ||
    'https://cdn.discordapp.com/embed/avatars/0.png';
  leadershipSection.setThumbnailAccessory(thumbnail =>
    thumbnail
      .setURL(accessoryThumbnailUrl)
      .setDescription(`${guild.name} guild icon`)
  );

  container.addSectionComponents(leadershipSection);

  // Managers section (if any)
  if (managers.length > 0) {
    const managersText = new TextDisplayBuilder()
      .setContent(`**${emojis.manager} Managers**\n${formatUserList(managers)}`);
    container.addTextDisplayComponents(managersText);
  }

  // Region stats section with multi-region support
  const regionLabel = regionStats?.region || '—';
  const regionStatsText = buildRegionStatsText(regionStats, activeRegions, false);
  container.addTextDisplayComponents(regionStatsText);

  // Add region selector if guild has multiple active regions
  const regionRow = buildRegionSelector('guild_view', guildId, activeRegions, regionLabel);
  if (regionRow) container.addActionRowComponents(regionRow);

  // Add separator before rosters
  const separator = new SeparatorBuilder();
  container.addSeparatorComponents(separator);

  // Main roster section
  const mainRosterText = new TextDisplayBuilder()
    .setContent(`**${emojis.mainRoster} Main Roster**\n${formatUserList(mainRoster)}`);
  container.addTextDisplayComponents(mainRosterText);

  // Sub roster section
  const subRosterText = new TextDisplayBuilder()
    .setContent(`**${emojis.subRoster} Sub Roster**\n${formatUserList(subRoster)}`);
  container.addTextDisplayComponents(subRosterText);

  // Banner image at the bottom if configured
  if (guild.bannerUrl) {
    const bannerGallery = new MediaGalleryBuilder()
      .addItems(
        new MediaGalleryItemBuilder()
          .setURL(guild.bannerUrl)
          .setDescription(`${guild.name} banner`)
      );
    container.addMediaGalleryComponents(bannerGallery);
  }

  return container;
}

module.exports = { buildGuildDetailDisplayComponents };

