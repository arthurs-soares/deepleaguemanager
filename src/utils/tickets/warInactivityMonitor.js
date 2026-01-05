const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const War = require('../../models/war/War');
const Guild = require('../../models/guild/Guild');
const LoggerService = require('../../services/LoggerService');

// 7 days in milliseconds
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Check channel inactivity by fetching last message
 * @param {import('discord.js').TextChannel} channel
 * @param {number} inactivityMs
 */
async function isChannelInactive(channel, inactivityMs) {
  const now = Date.now();
  let lastTs = channel.lastMessage?.createdTimestamp
    || channel.messages?.cache?.get(channel.lastMessageId)?.createdTimestamp
    || null;

  if (!lastTs) {
    try {
      const msgs = await channel.messages.fetch({ limit: 1 });
      const last = msgs.first();
      lastTs = last?.createdTimestamp || null;
    } catch (_) {
      lastTs = null;
    }
  }

  if (!lastTs) return false;
  return now - lastTs >= inactivityMs;
}

/**
 * Check if war ticket is inactive for 7+ days
 * @param {Object} war - War document
 * @param {import('discord.js').TextChannel} channel
 * @returns {Promise<boolean>}
 */
async function isWarTicketInactiveFor7Days(war, channel) {
  if (!war || !channel) return false;
  if (war.status !== 'aberta') return false;

  const now = Date.now();

  if (war.inactivityReactivatedAt) {
    const reactivatedAt = new Date(war.inactivityReactivatedAt).getTime();
    if (now - reactivatedAt < SEVEN_DAYS_MS) {
      return false;
    }
  }

  if (war.lastInactivityWarningAt) {
    const lastWarningAt = new Date(war.lastInactivityWarningAt).getTime();
    if (now - lastWarningAt < SEVEN_DAYS_MS) {
      return false;
    }
  }

  return isChannelInactive(channel, SEVEN_DAYS_MS);
}

/**
 * Send inactivity warning for war ticket
 * @param {import('discord.js').Client} client
 * @param {Object} war - War document
 * @param {import('discord.js').TextChannel} channel
 */
async function sendWarInactivityWarning(client, war, channel) {
  try {
    const [guildA, guildB] = await Promise.all([
      Guild.findById(war.guildAId).lean().catch(() => null),
      Guild.findById(war.guildBId).lean().catch(() => null)
    ]);

    const guildAName = guildA?.name || 'Guild A';
    const guildBName = guildB?.name || 'Guild B';

    const reactivateButton = new ButtonBuilder()
      .setCustomId(`war:reactivate:${war._id}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Reactivate Ticket (+7 days)')
      .setEmoji('🔄');

    const actionRow = new ActionRowBuilder().addComponents(reactivateButton);

    const warningMessage =
      `⚠️ **War Ticket Inactivity Warning**\n\n` +
      `This war ticket between **${guildAName}** vs **${guildBName}** ` +
      `has been inactive for **7 days**.\n\n` +
      `If no action is taken, this ticket will be subject to deletion.\n\n` +
      `Click below to reactivate for another 7 days.`;

    await channel.send({
      content: warningMessage,
      components: [actionRow]
    });

    war.lastInactivityWarningAt = new Date();
    await war.save();

    LoggerService.info(`[War Inactivity] Warning sent for war ${war._id}`, {
      guildA: guildAName,
      guildB: guildBName,
      channelId: channel.id
    });

  } catch (err) {
    LoggerService.error('[War Inactivity] Error sending warning:', {
      warId: war._id?.toString(),
      error: err?.message
    });
  }
}

/**
 * Scan for inactive war tickets
 * @param {import('discord.js').Client} client
 */
async function scanInactiveWarTickets(client) {
  const guilds = client.guilds.cache;

  for (const [, guild] of guilds) {
    try {
      const openWars = await War.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'aberta'
      }).catch(() => []);

      for (const war of openWars) {
        const channel = guild.channels.cache.get(war.channelId);
        if (!channel) continue;

        const needsWarning = await isWarTicketInactiveFor7Days(war, channel);

        if (needsWarning) {
          try {
            await sendWarInactivityWarning(client, war, channel);
          } catch (err) {
            LoggerService.error(`[War Inactivity] Error: war ${war._id}:`, err);
          }
        }
      }
    } catch (err) {
      LoggerService.error(`[War Inactivity] Guild ${guild.id}:`, err);
    }
  }
}

/**
 * Schedule war inactivity monitor
 * @param {import('discord.js').Client} client
 */
function scheduleWarInactivityMonitor(client) {
  const intervalMs = 6 * 60 * 60 * 1000; // 6 hours

  setTimeout(() => scanInactiveWarTickets(client).catch(err => {
    LoggerService.error('[War Inactivity] Scan error:', err);
  }), 3 * 60 * 1000);

  setInterval(() => scanInactiveWarTickets(client).catch(err => {
    LoggerService.error('[War Inactivity] Scan error:', err);
  }), intervalMs);

  LoggerService.info('[War Inactivity] Monitor scheduled - every 6 hours');
}

module.exports = {
  scheduleWarInactivityMonitor,
  scanInactiveWarTickets,
  isWarTicketInactiveFor7Days
};
