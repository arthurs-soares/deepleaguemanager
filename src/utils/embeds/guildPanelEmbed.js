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

  // Single container
  const container = new ContainerBuilder().setAccentColor(color);

  // --- HEADER ---
  // Title section with icon thumbnail if available
  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.leader} ${guild.name}`);

  // Get guild icon or fallback to Discord server icon
  const serverIconUrl = _discordGuild?.iconURL({ dynamic: true, size: 128 });
  const guildIconUrl = guild.iconUrl || serverIconUrl;

  const headerSection = new SectionBuilder().addTextDisplayComponents(titleText);
  if (guildIconUrl) {
    headerSection.setThumbnailAccessory(thumbnail =>
      thumbnail.setURL(guildIconUrl).setDescription(`${guild.name} icon`)
    );
  }
  container.addSectionComponents(headerSection);

  // --- LEADERSHIP SECTION ---
  container.addSeparatorComponents(new SeparatorBuilder());

  const leaderText = new TextDisplayBuilder()
    .setContent(`**${emojis.leader} Leader**\n${guild.leader || '—'}`);

  const leaderSection = new SectionBuilder().addTextDisplayComponents(leaderText);
  leaderSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:transfer_leadership:${guildId}`)
      .setLabel('Transfer')
      .setStyle(ButtonStyle.Secondary)
  );
  container.addSectionComponents(leaderSection);

  const coLeaderText = new TextDisplayBuilder()
    .setContent(`**${emojis.coLeader} Co-leader**\n${coLeader?.username || '—'}`);

  const coLeaderSection = new SectionBuilder().addTextDisplayComponents(coLeaderText);
  if (!coLeader) {
    coLeaderSection.setButtonAccessory(button =>
      button
        .setCustomId(`guild_panel:add_co_leader:${guildId}`)
        .setLabel('Add')
        .setStyle(ButtonStyle.Secondary)
    );
  } else {
    coLeaderSection.setButtonAccessory(button =>
      button
        .setCustomId(`guild_panel:change_co_leader:${guildId}`)
        .setLabel('Change')
        .setStyle(ButtonStyle.Secondary)
    );
  }
  container.addSectionComponents(coLeaderSection);

  // --- MANAGERS & MEMBERS SECTION ---
  container.addSeparatorComponents(new SeparatorBuilder());

  const managersArray = Array.isArray(guild.managers) ? guild.managers : [];
  const managersText = new TextDisplayBuilder()
    .setContent(`**${emojis.manager || '👔'} Managers (${managersArray.length}/2)**\n${formatManagersList(managersArray)}`);

  const managersSection = new SectionBuilder().addTextDisplayComponents(managersText);
  managersSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:manage_managers:${guildId}`)
      .setLabel('Manage')
      .setStyle(ButtonStyle.Secondary)
  );
  container.addSectionComponents(managersSection);

  // Members count
  const uniqueIds = new Set();
  const membersArr = Array.isArray(guild.members) ? guild.members : [];
  for (const m of membersArr) if (m.userId) uniqueIds.add(m.userId);
  const managersArr = Array.isArray(guild.managers) ? guild.managers : [];
  for (const managerId of managersArr) if (managerId) uniqueIds.add(managerId);
  const allRegions = Array.isArray(guild.regions) ? guild.regions : [];
  for (const reg of allRegions) {
    (reg.mainRoster || []).forEach(id => { if (id) uniqueIds.add(id); });
    (reg.subRoster || []).forEach(id => { if (id) uniqueIds.add(id); });
  }
  (guild.mainRoster || []).forEach(id => { if (id) uniqueIds.add(id); });
  (guild.subRoster || []).forEach(id => { if (id) uniqueIds.add(id); });
  if (guild.registeredBy) uniqueIds.add(guild.registeredBy);

  const memberCount = uniqueIds.size;
  const membersText = new TextDisplayBuilder()
    .setContent(`**${emojis.members || '👥'} Total Members**\n${memberCount}`);
  container.addTextDisplayComponents(membersText);

  // --- ROSTERS SECTION ---
  container.addSeparatorComponents(new SeparatorBuilder());

  const rosterRegion = regionStats?.region || activeRegions[0]?.region || 'N/A';
  const rostersText = new TextDisplayBuilder()
    .setContent(`**${emojis.rosters || '📜'} Rosters (${rosterRegion})**\n${formatRegionRosterCounts(guild, rosterRegion)}`);

  const rostersSection = new SectionBuilder().addTextDisplayComponents(rostersText);
  rostersSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:edit_roster:${guildId}`)
      .setLabel('Edit Roster')
      .setStyle(ButtonStyle.Primary)
  );
  container.addSectionComponents(rostersSection);

  // --- REGION SPECS ---
  const regionLabel = regionStats?.region || '—';
  const regionStatsText = buildRegionStatsText(regionStats, activeRegions, true);
  container.addTextDisplayComponents(regionStatsText);

  const regionRow = buildRegionSelector('guild_panel', guildId, activeRegions, regionLabel);
  if (regionRow) container.addActionRowComponents(regionRow);

  // --- FOOTER & INFO ---
  container.addSeparatorComponents(new SeparatorBuilder());

  if (guild.description) {
    const descText = new TextDisplayBuilder()
      .setContent(`**Description**\n*${guild.description}*`);
    container.addTextDisplayComponents(descText);
  }

  const createdText = new TextDisplayBuilder()
    .setContent(`**Created**\n<t:${Math.floor(new Date(guild.createdAt).getTime() / 1000)}:F>`);

  const createdSection = new SectionBuilder().addTextDisplayComponents(createdText);
  createdSection.setButtonAccessory(button =>
    button
      .setCustomId(`guild_panel:edit_data:${guildId}`)
      .setLabel('Edit Data')
      .setStyle(ButtonStyle.Secondary)
  );
  container.addSectionComponents(createdSection);

  if (guild.registeredBy) {
    const regText = new TextDisplayBuilder()
      .setContent(`*Registered by: ${guild.registeredBy}*`);
    container.addTextDisplayComponents(regText);
  }

  // --- BANNER ---
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
