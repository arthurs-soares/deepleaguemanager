const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Guild = require('../../models/guild/Guild');
const { colors, emojis } = require('../../config/botConfig');
const { getOrCreateServerSettings, setLeaderboardMessage } = require('../system/serverSettings');
const { sortByRanking, calcRatio } = require('../war/warRanking');
const { getRankEmoji, createWinRateBar, formatWinRateDisplay, formatGuildName } = require('../leaderboard/visualFormatting');
const { calculateLeaderboardStats, formatStatsDisplay, getPerformanceTrend } = require('../leaderboard/leaderboardStats');

/**
 * Builds the leaderboard container for a server
 * - Lists guilds with wins/losses and win rate
 * - Sorts by performance (win rate, then wins)
 * @param {import('discord.js').Guild} discordGuild
 */
async function buildLeaderboardEmbed(discordGuild) {
  let guilds = [];
  try {
    guilds = await Guild.find({ discordGuildId: discordGuild.id });
  } catch (_) { guilds = []; }
  const ordered = sortByRanking(guilds);

  // Calculate server statistics
  const stats = calculateLeaderboardStats(ordered);
  const statsDisplay = formatStatsDisplay(stats);

  const lines = await Promise.all(ordered.slice(0, 15).map(async (g, i) => {
    const rank = i + 1;
    const w = g.wins || 0;
    const l = g.losses || 0;
    const rate = calcRatio(g);
    const rankEmoji = getRankEmoji(rank);
    const trend = getPerformanceTrend(g);
    const winRateDisplay = formatWinRateDisplay(rate);
    const winRateBar = createWinRateBar(rate);
    const formattedName = formatGuildName(g.name, 18);

    return `${rankEmoji} **#${rank}** ${formattedName} ${trend}\n` +
      `\`\`\`${winRateBar}\`\`\`` +
      `**${w}W/${l}L** • ${winRateDisplay}`;
  }));

  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.leaderboard} Guild War Leaderboard`);

  const contentText = new TextDisplayBuilder()
    .setContent(lines.length ?
      `${statsDisplay}\n\n${lines.join('\n\n')}` :
      `${emojis.warning} No guilds registered yet.`);

  const footerText = new TextDisplayBuilder()
    .setContent(`*${emojis.schedule} Auto-updates hourly • ${stats.totalGuilds} total guilds*`);

  const timestampText = new TextDisplayBuilder()
    .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

  container.addTextDisplayComponents(titleText, contentText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Manual Update Button
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('leaderboard:update:guild')
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  );
  container.addActionRowComponents(actionRow);

  container.addTextDisplayComponents(footerText, timestampText);

  return container;
}

/**
 * Publish or update the leaderboard message in the configured channel
 * - If leaderboardMessageId exists, try to edit; otherwise, send new and save the ID
 * @param {import('discord.js').Guild} discordGuild
 */
async function upsertLeaderboardMessage(discordGuild) {
  const settings = await getOrCreateServerSettings(discordGuild.id);
  if (!settings.leaderboardChannelId) return { ok: false, reason: 'no-channel' };

  const channel = discordGuild.channels.cache.get(settings.leaderboardChannelId);
  if (!channel || !channel.isTextBased?.()) return { ok: false, reason: 'invalid-channel' };

  const container = await buildLeaderboardEmbed(discordGuild);
  const { MessageFlags } = require('discord.js');

  // Try to edit existing message
  if (settings.leaderboardMessageId) {
    try {
      const msg = await channel.messages.fetch(settings.leaderboardMessageId);
      await msg.edit({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] }
      });
      return { ok: true, updated: true };
    } catch (_) {
      // continue to create new one
    }
  }

  // Send new message
  const sent = await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  });
  await setLeaderboardMessage(discordGuild.id, sent.id);
  try { await sent.pin(); } catch (_) { }
  return { ok: true, created: true };
}

/**
 * Schedule hourly leaderboard updates
 * - Runs once at startup and then hourly
 * @param {import('discord.js').Client} client
 */
function scheduleDailyLeaderboard(client) {
  // Execute once after 15s
  setTimeout(() => {
    client.guilds.cache.forEach(g => upsertLeaderboardMessage(g).catch(() => { }));
  }, 15_000);

  function msUntilNextHour() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(now.getHours() + 1, 0, 0, 0);
    return next - now;
  }

  async function scheduleNextTick() {
    const delay = msUntilNextHour();
    setTimeout(async () => {
      try {
        for (const g of client.guilds.cache.values()) {
          await upsertLeaderboardMessage(g);
        }
      } catch (_) { }
      scheduleNextTick();
    }, delay).unref?.();
  }

  scheduleNextTick();
}

module.exports = { buildLeaderboardEmbed, upsertLeaderboardMessage, scheduleDailyLeaderboard };

