const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder
} = require('@discordjs/builders');
const { ButtonStyle } = require('discord.js');

const { colors, emojis } = require('../../config/botConfig');
const {
  getRegionStatsForDisplay,
  formatManagersList,
  buildRegionStatsText,
  buildRegionSelector,
  formatRegionRosterCounts
} = require('./guildDisplayHelpers');


/**
 * Build the guild panel using Display Components v2
 * - Uses ContainerBuilder for main layout
 * - Uses SectionBuilder for organized information display
 * - Maintains all existing functionality with modern components
 * @param {Object} guild - Guild document
 * @param {import('discord.js').Guild} _discordGuild - Discord guild object
 * @param {string} [selectedRegion] - Selected region for stats display
 * @returns {Promise<ContainerBuilder[]>}
 */
async function buildGuildPanelDisplayComponents(guild, _discordGuild, selectedRegion = null) {

  const members = Array.isArray(guild.members) ? guild.members : [];
  const coLeader = members.find(m => m.role === 'vice-lider');

  const guildId = guild.id || guild._id;
  const regionStats = getRegionStatsForDisplay(guild, selectedRegion);
  const activeRegions = (guild.regions || []).filter(r => r.status === 'active');

  const color = guild.color ? parseInt(guild.color.replace('#', ''), 16) : colors.primary;

  // Single container: merge top and bottom; add a visual separator between
  const container = new ContainerBuilder().setAccentColor(color);

  // Title section with icon thumbnail if available
  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.leader} ${guild.name}`);

  // Get guild icon or fallback to Discord server icon
  const serverIconUrl = _discordGuild?.iconURL({ dynamic: true, size: 128 });
  const guildIconUrl = guild.iconUrl || serverIconUrl;

  if (guildIconUrl) {
    const titleSection = new SectionBuilder()
      .addTextDisplayComponents(titleText);
    titleSection.setThumbnailAccessory(thumbnail =>
      thumbnail
        .setURL(guildIconUrl)
        .setDescription(`${guild.name} icon`)
    );
    container.addSectionComponents(titleSection);
  } else {
    container.addTextDisplayComponents(titleText);
  }

  // Leadership section
  const leaderText = new TextDisplayBuilder()
    .setContent(`**${emojis.leader} Leader**\n${guild.leader || '—'}`);
  const coLeaderText = new TextDisplayBuilder()
    .setContent(`**${emojis.coLeader} Co-leader**\n${coLeader?.username || '—'}`);

  // Use region-specific roster counts
  const rosterRegion = regionStats?.region || activeRegions[0]?.region || 'N/A';
  const rostersLeadershipText = new TextDisplayBuilder()
    .setContent(`**Rosters (${rosterRegion})**\n${formatRegionRosterCounts(guild, rosterRegion)}`);

  // Leader + inline action
  const leaderActionSection = new SectionBuilder()
    .addTextDisplayComponents(leaderText);
  leaderActionSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:transfer_leadership:${guildId}`)
      .setLabel('Transfer Leader')
      .setStyle(ButtonStyle.Primary)
  );
  container.addSectionComponents(leaderActionSection);

  // Co-leader section with inline Add Co-leader button (or thumbnail when exists)
  const coLeaderSection = new SectionBuilder()
    .addTextDisplayComponents(coLeaderText);
  if (!coLeader) {
    coLeaderSection.setButtonAccessory(button =>
      button
        .setCustomId(`guild_panel:add_co_leader:${guildId}`)
        .setLabel('Add Co-leader')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    coLeaderSection.setButtonAccessory(button =>
      button
        .setCustomId(`guild_panel:change_co_leader:${guildId}`)
        .setLabel('Change Co-leader')
        .setStyle(ButtonStyle.Secondary)
    );
  }

  container.addSectionComponents(coLeaderSection);

  // Rosters section with inline Edit button
  const rostersSection = new SectionBuilder()
    .addTextDisplayComponents(rostersLeadershipText);
  rostersSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:edit_roster:${guildId}`)
      .setLabel('Edit Roster')
      .setStyle(ButtonStyle.Primary)
  );
  container.addSectionComponents(rostersSection);

  // Managers section with inline Manage Managers button
  const managersArray = Array.isArray(guild.managers) ? guild.managers : [];
  const managersText = new TextDisplayBuilder()
    .setContent(`**Managers (${managersArray.length}/2)**\n${formatManagersList(managersArray)}`);
  const managersSection = new SectionBuilder()
    .addTextDisplayComponents(managersText);
  managersSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:manage_managers:${guildId}`)
      .setLabel('Manage Managers')
      .setStyle(ButtonStyle.Secondary)
  );
  container.addSectionComponents(managersSection);

  // Members count - aggregate all unique guild members
  const uniqueIds = new Set();

  // Add all users from members array (leader, co-leader, members)
  const membersArr = Array.isArray(guild.members) ? guild.members : [];
  for (const m of membersArr) {
    if (m.userId) uniqueIds.add(m.userId);
  }

  // Add managers
  const managersArr = Array.isArray(guild.managers) ? guild.managers : [];
  for (const managerId of managersArr) {
    if (managerId) uniqueIds.add(managerId);
  }

  // Add all users from regions' rosters
  const allRegions = Array.isArray(guild.regions) ? guild.regions : [];
  for (const reg of allRegions) {
    const regionMain = Array.isArray(reg.mainRoster) ? reg.mainRoster : [];
    const regionSub = Array.isArray(reg.subRoster) ? reg.subRoster : [];
    regionMain.forEach(id => { if (id) uniqueIds.add(id); });
    regionSub.forEach(id => { if (id) uniqueIds.add(id); });
  }

  // Add legacy global rosters (for guilds not yet migrated)
  const legacyMain = Array.isArray(guild.mainRoster) ? guild.mainRoster : [];
  const legacySub = Array.isArray(guild.subRoster) ? guild.subRoster : [];
  legacyMain.forEach(id => { if (id) uniqueIds.add(id); });
  legacySub.forEach(id => { if (id) uniqueIds.add(id); });

  // Add registeredBy user
  if (guild.registeredBy) uniqueIds.add(guild.registeredBy);
  const memberCount = uniqueIds.size;
  const membersText = new TextDisplayBuilder()
    .setContent(`**Members**\n${memberCount}`);
  container.addTextDisplayComponents(membersText);


  // Separator between top and bottom (Components V2)
  const separator = new SeparatorBuilder();
  container.addSeparatorComponents(separator);

  // Region Stats Section using shared helpers
  const regionLabel = regionStats?.region || '—';
  const regionStatsText = buildRegionStatsText(regionStats, activeRegions, true);
  container.addTextDisplayComponents(regionStatsText);

  const regionRow = buildRegionSelector('guild_panel', guildId, activeRegions, regionLabel);
  if (regionRow) container.addActionRowComponents(regionRow);

  // Separator before description
  container.addSeparatorComponents(new SeparatorBuilder());

  // Description — labeled, after separator
  if (guild.description) {
    const descText = new TextDisplayBuilder()
      .setContent(`**Description:**\n${guild.description}`);
    container.addTextDisplayComponents(descText);
  }

  // Guild statistics with inline Edit Data button next to Created
  const createdText = new TextDisplayBuilder()
    .setContent(`**Created**\n<t:${Math.floor(new Date(guild.createdAt).getTime() / 1000)}:F>`);
  const createdSection = new SectionBuilder().addTextDisplayComponents(createdText);
  createdSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:edit_data:${guildId}`)
      .setLabel('Edit Data')
      .setStyle(ButtonStyle.Success)
  );
  container.addSectionComponents(createdSection);

  // Footer information
  if (guild.registeredBy) {
    const footerText = new TextDisplayBuilder()
      .setContent(`*Registered by: ${guild.registeredBy}*`);
    container.addTextDisplayComponents(footerText);
  }

  // Banner image at the end if configured
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

module.exports = { buildGuildPanelDisplayComponents };
