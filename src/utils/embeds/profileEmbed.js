const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const { getOrCreateUserProfile } = require('../user/userProfile');
const { getUserGuildInfo } = require('../guilds/userGuildInfo');
const { getRoleDisplayLabel } = require('../core/roleMapping');
const UserProfile = require('../../models/user/UserProfile');

// Small helpers to keep functions short and readable
function formatTs(d, style = 'd') {
  try { return `<t:${Math.floor(new Date(d).getTime() / 1000)}:${style}>`; }
  catch { return null; }
}

async function buildGuildInfoField(discordGuildId, targetUserId) {
  const { guild, role, joinedAt } = await getUserGuildInfo(
    discordGuildId,
    targetUserId
  );
  if (!guild) {
    return {
      name: `${emojis.guild} Guild Information`,
      value: `${emojis.guild} Not in any guild`,
      inline: true
    };
  }
  const roleLabel = role === 'main' ? 'Main Roster'
    : role === 'sub' ? 'Sub Roster'
      : getRoleDisplayLabel(role);
  const joined = joinedAt ? ` • Joined ${formatTs(joinedAt, 'd')}` : '';
  return {
    name: `${emojis.guild} Guild Information — ${guild.name}`,
    value: `Status: ${roleLabel}${joined}`,
    inline: true
  };
}

function computeWagerStats(profile) {
  const games = profile.wagerGamesPlayed || 0;
  const wins = profile.wagerWins || 0;
  const losses = profile.wagerLosses || 0;
  const rate = games > 0 ? Math.round((wins / games) * 100) : 0;
  const streak = profile.wagerWinStreak > 0 ? `🔥 ${profile.wagerWinStreak}W`
    : profile.wagerLossStreak > 0 ? `❄️ ${profile.wagerLossStreak}L` : '—';
  return { games, wins, losses, rate, streak };
}

async function getServerRank(discordGuild, targetUserId) {
  const serverMembers = [...discordGuild.members.cache.keys()];
  const all = await UserProfile.find({ discordUserId: { $in: serverMembers } })
    .sort({ wagerWins: -1, wagerGamesPlayed: -1 });
  const idx = all.findIndex(p => p.discordUserId === targetUserId);
  return { rank: idx >= 0 ? idx + 1 : 0, total: all.length };
}

function _buildStatsFields(wager, _rank) {
  return [
    {
      name: '📊 Wager Stats',
      value: `**Games:** ${wager.games}\n**W/L:** ${wager.wins}/${wager.losses}` +
             ` (${wager.rate}%)\n**Streak:** ${wager.streak}`,
      inline: true
    }
  ];
}

function buildAccountField(member, user) {
  const joined = member?.joinedAt ? formatTs(member.joinedAt, 'd') : 'Unknown';
  const created = formatTs(user.createdAt, 'd');
  // Compact single-line to help horizontal layout
  return {
    name: `${emojis.info} Account Info`,
    value: `Joined: ${joined} • Created: ${created}`,
    inline: false
  };
}

async function buildActionComponents(isSelf, hasGuild) {
  if (!isSelf) return [];
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('profile:edit')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Edit Profile')
      .setEmoji('✏️'),
    new ButtonBuilder()
      .setCustomId('profile:leaveGuild')
      .setStyle(ButtonStyle.Danger)
      .setLabel('Leave Guild')
      .setEmoji('🚪')
      .setDisabled(!hasGuild)
  );
  return [row];
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

  // Resolve accent color (hex string or number)
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

  // Header with name
  const displayName = targetUser.displayName || targetUser.username;
  const header = new TextDisplayBuilder()
    .setContent(`# 👤 ${displayName}`);
  const desc = new TextDisplayBuilder()
    .setContent(profile.description || '*No description set*');
  container.addTextDisplayComponents(header, desc);

  // Core stats in a section with avatar accessory
  const statsText = new TextDisplayBuilder().setContent(
    `**📊 Wager Stats**\n` +
    `Games: **${wager.games}** • W/L: **${wager.wins}/${wager.losses}** ` +
    `(${wager.rate}%) • Streak: ${wager.streak}\n` +
    `Rank: **#${rank.rank}** of ${rank.total}`
  );
  const guildText = new TextDisplayBuilder().setContent(
    `**${guildField.name}**\n${guildField.value}`
  );
  const accountField = buildAccountField(member, targetUser);

  const accountText = new TextDisplayBuilder().setContent(
    `**${accountField.name}**\n${accountField.value}`
  );

  const section = new SectionBuilder()
    .addTextDisplayComponents(statsText, guildText, accountText);
  const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 512 });
  section.setThumbnailAccessory(t =>
    t.setURL(avatarUrl).setDescription(`${displayName} avatar`)
  );
  container.addSectionComponents(section);

  // Optional banner preview as accessory section
  if (typeof profile.bannerUrl === 'string'
    ? profile.bannerUrl.trim().length > 0
    : Boolean(profile.bannerUrl)) {
    const bannerSection = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent('**Banner**')
      );
    bannerSection.setThumbnailAccessory(t =>
      t.setURL(profile.bannerUrl).setDescription('Profile banner')
    );
    container.addSectionComponents(bannerSection);
  }

  // Footer
  const footer = new TextDisplayBuilder()
    .setContent(
      `*Requested by ${viewerUser.displayName || viewerUser.username}*`
    );
  container.addTextDisplayComponents(footer);

  const hasGuild = guildField.value
    && !guildField.value.includes('Not in any guild');
  const components = await buildActionComponents(
    targetUser.id === viewerUser.id,
    hasGuild
  );

  return { container, components };
}

module.exports = { buildUserProfileDisplayComponents };

