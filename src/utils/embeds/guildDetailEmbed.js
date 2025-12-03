const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const { normalizeRoleToPortuguese } = require('../core/roleMapping');


/**
 * Build guild details using Display Components v2
 * - Uses ContainerBuilder for main layout
 * - Uses SectionBuilder for organized information display
 * - Includes all existing functionality with modern components
 * @param {Object} guild - Guild document
 * @param {import('discord.js').Guild} _discordGuild - Discord guild object
 * @returns {Promise<ContainerBuilder>}
 */
async function buildGuildDetailDisplayComponents(guild, _discordGuild) {

  const members = Array.isArray(guild.members) ? guild.members : [];
  const leaderMember = members.find(m => normalizeRoleToPortuguese(m.role) === 'lider');
  const coLeader = members.find(m => normalizeRoleToPortuguese(m.role) === 'vice-lider');
  const mainRoster = Array.isArray(guild.mainRoster) ? guild.mainRoster : [];
  const subRoster = Array.isArray(guild.subRoster) ? guild.subRoster : [];

  const color = guild.color ? parseInt(guild.color.replace('#', ''), 16) : colors.primary;

  // Create main container
  const container = new ContainerBuilder()
    .setAccentColor(color);

  // Header section with guild name and description
  const headerText = new TextDisplayBuilder()
    .setContent(`# ${emojis.guild} Guild Details: ${guild.name}`);

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

  // SectionBuilder requires an accessory; always set a thumbnail accessory
  const accessoryThumbnailUrl = guild.iconUrl || guild.bannerUrl ||
    'https://cdn.discordapp.com/embed/avatars/0.png';
  leadershipSection.setThumbnailAccessory(thumbnail =>
    thumbnail
      .setURL(accessoryThumbnailUrl)
      .setDescription(`${guild.name} guild icon`)
  );

  container.addSectionComponents(leadershipSection);

  // Statistics section - use individual TextDisplayBuilder components
  const winsLossesText = new TextDisplayBuilder()
    .setContent(
      `**${emojis.winsLosses} Wins/Losses**\n${guild.wins||0} / ${guild.losses||0}`
    );

  // Add individual statistics text components
  container.addTextDisplayComponents(winsLossesText);

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


  return container;
}

function formatUserList(ids) {
  if (!ids || ids.length === 0) return '—';
  const items = ids.map(id => `<@${id}>`);
  const text = items.join(', ');
  return text.length > 1000 ? text.slice(0, 1000) + '…' : text;
}

module.exports = { buildGuildDetailDisplayComponents };

