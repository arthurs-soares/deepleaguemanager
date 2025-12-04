const {
  ContainerBuilder,
  SectionBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { MessageFlags, ButtonStyle } = require('discord.js');
const EventPoints = require('../../models/rewards/EventPoints');
const { colors, emojis } = require('../../config/botConfig');
const {
  getOrCreateServerSettings,
  setEventPointsLeaderboardMessage
} = require('../system/serverSettings');
const { getRankEmoji } = require('./visualFormatting');
const { paginate } = require('../misc/pagination');
const LoggerService = require('../../services/LoggerService');

/**
 * Fetch users ordered by event points for a Discord server
 * @param {string} discordGuildId - Discord server ID
 * @param {import('discord.js').Guild} [discordGuild] - Discord guild
 * @returns {Promise<Array>} Array of event points records
 */
async function fetchUsersOrderedByEventPoints(discordGuildId, discordGuild = null) {
  try {
    if (discordGuild && discordGuild.members) {
      try { await discordGuild.members.fetch(); } catch (_) {}
      const memberIds = [...discordGuild.members.cache
        .filter(m => !m.user?.bot)
        .keys()];

      if (memberIds.length === 0) return [];

      // Include all users with non-zero points (positive or negative)
      return await EventPoints.find({
        discordGuildId,
        userId: { $in: memberIds },
        points: { $ne: 0 }
      }).sort({ points: -1, totalEarned: -1, userId: 1 });
    }

    // Include all users with non-zero points (positive or negative)
    return await EventPoints.find({
      discordGuildId,
      points: { $ne: 0 }
    }).sort({ points: -1, totalEarned: -1, userId: 1 });
  } catch (error) {
    return [];
  }
}

/**
 * Format username for display (without mentions)
 * @param {string} userId - Discord user ID
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {number} maxLength - Maximum length
 * @returns {string} Formatted username
 */
function formatUsername(userId, discordGuild, maxLength = 16) {
  const member = discordGuild?.members?.cache?.get(userId);
  const username = member?.user?.username ||
    member?.displayName ||
    `User${userId.slice(-4)}`;

  if (username.length > maxLength) {
    return username.slice(0, maxLength - 1) + '…';
  }
  return username;
}

/**
 * Build event points leaderboard container with pagination - Components v2
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @param {number} page - Current page number
 * @param {number} pageSize - Users per page
 * @returns {Promise<ContainerBuilder>} Leaderboard container
 */
async function buildEventPointsLeaderboardEmbed(
  discordGuild,
  page = 1,
  pageSize = 20
) {
  const allUsers = await fetchUsersOrderedByEventPoints(
    discordGuild.id,
    discordGuild
  );

  const { slice, page: safePage, totalPages } = paginate(
    allUsers,
    page,
    pageSize
  );

  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.leaderboard || '🏆'} Event Points Leaderboard`);
  container.addTextDisplayComponents(titleText);

  if (!allUsers.length) {
    const emptyText = new TextDisplayBuilder()
      .setContent(`${emojis.warning || '⚠️'} No users with event points yet.`);
    container.addTextDisplayComponents(emptyText);
  } else {
    const totalPoints = allUsers.reduce((s, u) => s + (u.points || 0), 0);
    const statsText = new TextDisplayBuilder()
      .setContent(
        `👥 **${allUsers.length}** participants • ` +
        `⭐ **${totalPoints.toLocaleString()}** total points`
      );
    container.addTextDisplayComponents(statsText);
    container.addSeparatorComponents(new SeparatorBuilder());

    // Compact format: rank emoji + position + username + points (1 line each)
    const lines = slice.map((userPoints, i) => {
      const rank = (safePage - 1) * pageSize + i + 1;
      const points = userPoints.points || 0;
      const rankEmoji = getRankEmoji(rank);
      const username = formatUsername(userPoints.userId, discordGuild);

      return `${rankEmoji} **#${rank}** ${username} — ⭐ **${points.toLocaleString()}**`;
    });

    const usersText = new TextDisplayBuilder()
      .setContent(lines.join('\n'));
    container.addTextDisplayComponents(usersText);
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  // Pagination controls if multiple pages
  if (totalPages > 1) {
    const prevSection = new SectionBuilder();
    prevSection.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `📄 **Page ${safePage}/${totalPages}** • ${allUsers.length} users`
      )
    );
    prevSection.setButtonAccessory(btn =>
      btn
        .setCustomId(`eventpoints_lb:prev:${safePage}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('◀ Previous')
        .setDisabled(safePage <= 1)
    );
    container.addSectionComponents(prevSection);

    const nextSection = new SectionBuilder();
    nextSection.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('\u200B')
    );
    nextSection.setButtonAccessory(btn =>
      btn
        .setCustomId(`eventpoints_lb:next:${safePage}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Next ▶')
        .setDisabled(safePage >= totalPages)
    );
    container.addSectionComponents(nextSection);
  }

  const timestampText = new TextDisplayBuilder()
    .setContent(
      `*${emojis.schedule || '🕐'} Updated: <t:${Math.floor(Date.now() / 1000)}:R>*`
    );
  container.addTextDisplayComponents(timestampText);

  // Store pagination info for external use
  container.page = safePage;
  container.totalPages = totalPages;

  return container;
}

/**
 * Publish or update the event points leaderboard message
 * @param {import('discord.js').Guild} discordGuild - Discord guild
 * @returns {Promise<Object>} Result object
 */
async function upsertEventPointsLeaderboard(discordGuild) {
  try {
    const settings = await getOrCreateServerSettings(discordGuild.id);
    if (!settings.eventPointsLeaderboardChannelId) {
      return { ok: false, reason: 'no-channel' };
    }

    const channel = discordGuild.channels.cache.get(
      settings.eventPointsLeaderboardChannelId
    );
    if (!channel || !channel.isTextBased?.()) {
      return { ok: false, reason: 'invalid-channel' };
    }

    const container = await buildEventPointsLeaderboardEmbed(discordGuild);

    // Try to edit existing message
    if (settings.eventPointsLeaderboardMessageId) {
      try {
        const msg = await channel.messages.fetch(
          settings.eventPointsLeaderboardMessageId
        );
        await msg.edit({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
        return { ok: true, updated: true };
      } catch (fetchErr) {
        // Message not found or deleted, clear stored ID and create new one
        LoggerService.warn('Event leaderboard message not found, creating new', {
          error: fetchErr?.message
        });
        await setEventPointsLeaderboardMessage(discordGuild.id, null);
      }
    }

    // Send new message
    const sent = await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
    await setEventPointsLeaderboardMessage(discordGuild.id, sent.id);
    try { await sent.pin(); } catch (_) {}
    return { ok: true, created: true };
  } catch (error) {
    LoggerService.error('Failed to upsert event points leaderboard', {
      guildId: discordGuild?.id,
      error: error?.message
    });
    return { ok: false, reason: 'error', error: error?.message };
  }
}

module.exports = {
  fetchUsersOrderedByEventPoints,
  buildEventPointsLeaderboardEmbed,
  upsertEventPointsLeaderboard
};
