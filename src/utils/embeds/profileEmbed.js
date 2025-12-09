const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const { getOrCreateUserProfile } = require('../user/userProfile');
const { getUserGuildInfo } = require('../guilds/userGuildInfo');
const { getRoleDisplayLabel } = require('../core/roleMapping');
const { getOrCreateRoleConfig } = require('../misc/roleConfig');
const { createVisualProgressBar } = require('./visualHelpers');
const UserProfile = require('../../models/user/UserProfile');

// Small helpers to keep functions short and readable
function formatTs(d, style = 'd') {
  try { return `<t:${Math.floor(new Date(d).getTime() / 1000)}:${style}>`; }
  catch { return null; }
}

/**
 * Check if user has the no-wagers role
 * @param {GuildMember} member - Guild member
 * @param {string} noWagersRoleId - Role ID from config
 * @returns {boolean}
 */
function hasNoWagersRole(member, noWagersRoleId) {
  if (!member || !noWagersRoleId) return false;
  return member.roles.cache.has(noWagersRoleId);
}

async function buildGuildInfoField(discordGuildId, targetUserId) {
  const { guild, role, joinedAt } = await getUserGuildInfo(
    discordGuildId,
    targetUserId
  );
  if (!guild) {
    return {
      name: `${emojis.guild} Guild Information`,
      value: `*Not in any guild*`,
      inline: true
    };
  }
  const roleLabel = role === 'main' ? 'Main Roster'
    : role === 'sub' ? 'Sub Roster'
      : getRoleDisplayLabel(role);
  const joined = joinedAt ? ` • Joined ${formatTs(joinedAt, 'R')}` : '';

  return {
    name: `${emojis.guild} ${guild.name}`,
    value: `**${roleLabel}**${joined}`,
    inline: true,
    guildName: guild.name
  };
}

function computeWagerStats(profile) {
  const games = profile.wagerGamesPlayed || 0;
  const wins = profile.wagerWins || 0;
  const losses = profile.wagerLosses || 0;
  const rate = games > 0 ? Math.round((wins / games) * 100) : 0;

  // Format streak
  let streakDisplay = '—';
  if (profile.wagerWinStreak > 0) streakDisplay = `🔥 **${profile.wagerWinStreak}** Win Streak`;
  else if (profile.wagerLossStreak > 0) streakDisplay = `❄️ **${profile.wagerLossStreak}** Loss Streak`;

  // Visual bar
  const visualBar = createVisualProgressBar(rate, 8); // 8 blocks

  return { games, wins, losses, rate, streakDisplay, visualBar };
}

async function getServerRank(discordGuild, targetUserId) {
  const serverMembers = [...discordGuild.members.cache.keys()];
  const all = await UserProfile.find({ discordUserId: { $in: serverMembers } })
    .sort({ wagerWins: -1, wagerGamesPlayed: -1 });
  const idx = all.findIndex(p => p.discordUserId === targetUserId);

  const rank = idx >= 0 ? idx + 1 : 0;
  const total = all.length;

  // Rank badge logic
  let rankEmoji = '#';
  if (rank === 1) rankEmoji = '🥇';
  else if (rank === 2) rankEmoji = '🥈';
  else if (rank === 3) rankEmoji = '🥉';
  else if (rank <= 10) rankEmoji = '🏆';

  return { rank, total, rankEmoji };
}



/**
 * Build action row for profile buttons
 * @param {boolean} hasGuild - Whether user has a guild
 * @returns {ActionRowBuilder} Action row with buttons
 */
function buildActionRow(hasGuild) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile:edit')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Edit Profile')
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('profile:leaveGuild')
      .setStyle(ButtonStyle.Danger) // Danger for destructive actions
      .setLabel('Leave Guild')
      .setEmoji('🚪')
      .setDisabled(!hasGuild)
  );
}

async function buildUserProfileDisplayComponents(
  discordGuild,
  viewerUser,
  targetUser
) {
  const profile = await getOrCreateUserProfile(targetUser.id);
  const member = await discordGuild.members
    .fetch(targetUser.id)
    .catch(() => null);

  const guildField = await buildGuildInfoField(discordGuild.id, targetUser.id);

  const wager = computeWagerStats(profile);
  const rank = await getServerRank(discordGuild, targetUser.id);

  // Check wager opt status
  const roleCfg = await getOrCreateRoleConfig(discordGuild.id);
  const isOptedOut = hasNoWagersRole(member, roleCfg?.noWagersRoleId);
  const wagerStatus = isOptedOut
    ? { text: 'Opted Out', emoji: '🚫' }
    : { text: 'Active', emoji: '✅' };

  // Resolve accent color
  const color = (() => {
    const c = profile.color || colors.info;
    if (typeof c === 'string') {
      const hex = c.replace('#', '');
      const n = parseInt(hex, 16);
      return Number.isFinite(n) ? n : colors.info;
    }
    return c;
  })();

  const container = new ContainerBuilder().setAccentColor(color);

  // --- HEADER SECTION ---
  const displayName = targetUser.displayName || targetUser.username;
  const headerContent = `# 👤 ${displayName}`;

  const headerText = new TextDisplayBuilder().setContent(headerContent);

  const descContent = profile.description ? `*${profile.description}*` : '*No description set*';
  const descText = new TextDisplayBuilder().setContent(descContent);

  // --- STATS SECTION ---
  // Using a cleaner layout for stats
  const statsContent =
    `### ${emojis.dice || '🎲'} Wager Stats\n` +
    `**Rank:** ${rank.rankEmoji} **${rank.rank}** / ${rank.total}\n` +
    `**Win Rate:** ${wager.visualBar} ${wager.rate}%\n` +
    `**Record:** ${wager.wins}W - ${wager.losses}L (${wager.games} Games)\n` +
    `**Status:** ${wager.streakDisplay} • ${wagerStatus.emoji} ${wagerStatus.text}`;

  const statsText = new TextDisplayBuilder().setContent(statsContent);

  // --- GUILD & ACCOUNT SECTION ---
  // Combining these to save vertical space if appropriate, or keeping separate
  const guildContent =
    `### ${emojis.guild || '🛡️'} Current Guild\n` +
    `${guildField.value}`; // Value already formatted

  const guildText = new TextDisplayBuilder().setContent(guildContent);

  const accountContent =
    `### ${emojis.info || 'ℹ️'} Account\n` +
    `Joined: ${member?.joinedAt ? formatTs(member.joinedAt, 'R') : 'Unknown'} • Created: ${formatTs(targetUser.createdAt, 'R')}`;
  const accountText = new TextDisplayBuilder().setContent(accountContent);

  // Build the main section with avatar
  const mainSection = new SectionBuilder()
    .addTextDisplayComponents(headerText, descText);

  const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 512 });
  mainSection.setThumbnailAccessory(t =>
    t.setURL(avatarUrl).setDescription(`${displayName} avatar`)
  );

  container.addSectionComponents(mainSection);

  // Accessorize with Separator
  container.addSeparatorComponents(new SeparatorBuilder());

  // Stats Section
  container.addTextDisplayComponents(statsText);

  // Another Separator
  container.addSeparatorComponents(new SeparatorBuilder());

  // Info Section
  container.addTextDisplayComponents(guildText, accountText);

  // --- BANNER ---
  if (typeof profile.bannerUrl === 'string'
    ? profile.bannerUrl.trim().length > 0
    : Boolean(profile.bannerUrl)) {
    const bannerGallery = new MediaGalleryBuilder()
      .addItems(
        new MediaGalleryItemBuilder()
          .setURL(profile.bannerUrl)
          .setDescription('Profile banner')
      );
    container.addMediaGalleryComponents(bannerGallery);
  }

  // --- FOOTER ---
  const footerText = new TextDisplayBuilder()
    .setContent(`Requested by ${viewerUser.displayName || viewerUser.username}`);
  container.addTextDisplayComponents(footerText);

  // --- ACTION ROW ---
  const hasGuild = guildField.value && !guildField.value.includes('Not in any guild');
  const isSelf = targetUser.id === viewerUser.id;
  if (isSelf) {
    const actionRow = buildActionRow(hasGuild);
    container.addActionRowComponents(actionRow);
  }

  return { container };
}

module.exports = { buildUserProfileDisplayComponents };
