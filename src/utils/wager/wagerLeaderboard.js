const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { MessageFlags } = require('discord.js');
const UserProfile = require('../../models/user/UserProfile');
const { colors, emojis } = require('../../config/botConfig');
const {
  getOrCreateServerSettings,
  setWagerLeaderboardMessage
} = require('../system/serverSettings');
const LoggerService = require('../../services/LoggerService');

/**
 * Get rank emoji based on position
 * @param {number} rank - Position in leaderboard
 * @returns {string} Emoji for rank
 */
function getRankEmoji(rank) {
  if (rank === 1) return emojis.rankFirst;
  if (rank === 2) return emojis.rankSecond;
  if (rank === 3) return emojis.rankThird;
  return emojis.rankMedal;
}

/**
 * Build Wager leaderboard container for a server (top 15 active members)
 * Note: this filters by members present in the server.
 * @param {import('discord.js').Guild} discordGuild
 */
async function buildWagerLeaderboardEmbed(discordGuild) {
  // Ensure full member list and exclude bots for accurate ranking
  try { await discordGuild.members.fetch(); } catch (_) {}
  const memberIds = [...discordGuild.members.cache
    .filter(m => !m.user?.bot)
    .keys()];

  // Only include users with at least 1 wager played (W or L > 0)
  const users = await UserProfile.find({
    discordUserId: { $in: memberIds },
    $or: [
      { wagerWins: { $gt: 0 } },
      { wagerLosses: { $gt: 0 } }
    ]
  })
    .sort({
      wagerWins: -1,
      wagerGamesPlayed: -1,
      wagerLosses: 1,
      discordUserId: 1
    })
    .limit(15);

  const container = new ContainerBuilder();

  // Set accent color
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.leaderboard} Wager Leaderboard`);
  container.addTextDisplayComponents(titleText);

  if (!users.length) {
    const emptyText = new TextDisplayBuilder()
      .setContent(`${emojis.warning} No users found with wager stats yet.`);
    container.addTextDisplayComponents(emptyText);
  } else {
    // Stats
    const totalUsers = users.length;
    const totalWagers = users
      .reduce((sum, u) => sum + (u.wagerGamesPlayed || 0), 0);
    const totalWins = users
      .reduce((sum, u) => sum + (u.wagerWins || 0), 0);

    const statsText = new TextDisplayBuilder()
      .setContent(
        `📊 **${totalUsers}** active players • ` +
        `� **${totalWagers}** total wagers • ` +
        `🏆 **${totalWins}** total wins`
      );
    container.addTextDisplayComponents(statsText);
    container.addSeparatorComponents(new SeparatorBuilder());

    // User list
    const lines = users.map((u, i) => {
      const rank = i + 1;
      const w = u.wagerWins || 0;
      const l = u.wagerLosses || 0;
      const wagers = u.wagerGamesPlayed || 0;
      const wr = wagers > 0 ? Math.round((w / wagers) * 100) : 0;
      const rankEmoji = getRankEmoji(rank);

      return `${rankEmoji} **#${rank}** <@${u.discordUserId}>\n` +
             `🎲 **${wagers}** wagers • **${w}W/${l}L** (${wr}%)`;
    });

    const leaderboardText = new TextDisplayBuilder()
      .setContent(lines.join('\n\n'));
    container.addTextDisplayComponents(leaderboardText);

    // Footer
    container.addSeparatorComponents(new SeparatorBuilder());
    const footerText = new TextDisplayBuilder()
      .setContent(`*${totalUsers} active players*`);
    container.addTextDisplayComponents(footerText);
  }

  return container;
}

/**
 * Publish or update the wager leaderboard message in the configured channel
 * @param {import('discord.js').Guild} discordGuild
 */
async function upsertWagerLeaderboardMessage(discordGuild) {
  const cfg = await getOrCreateServerSettings(discordGuild.id);
  if (!cfg.wagerLeaderboardChannelId) return;

  const channel = discordGuild.channels.cache.get(cfg.wagerLeaderboardChannelId);
  if (!channel) return;

  const container = await buildWagerLeaderboardEmbed(discordGuild);
  const payload = {
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  };

  // If we have a saved message id, try to edit it
  if (cfg.wagerLeaderboardMessageId) {
    try {
      const msg = await channel.messages.fetch(cfg.wagerLeaderboardMessageId);
      if (msg) {
        await msg.edit(payload);
        return;
      }
    } catch (_) {
      // Message not found or cannot edit, send new one
    }
  }

  // Send new message and save its id
  try {
    const newMsg = await channel.send(payload);
    await setWagerLeaderboardMessage(discordGuild.id, newMsg.id);
  } catch (err) {
    LoggerService.error('Failed to send wager leaderboard message:', {
      error: err?.message
    });
  }
}

module.exports = { buildWagerLeaderboardEmbed, upsertWagerLeaderboardMessage };

