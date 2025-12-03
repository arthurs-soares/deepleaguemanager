const { Collection, MessageFlags, ChannelType } = require('discord.js');
const War = require('../../models/war/War');
const WagerTicket = require('../../models/wager/WagerTicket');
const { getWagerMentions, getWarMentions } = require('./participants');
const { sendTranscriptToLogs } = require('./transcript');
const { buildWagerDodgeEmbed } = require('../embeds/wagerDodgeEmbed');
const { sendWagerDodgeLog } = require('./wagerDodgeLog');
const LoggerService = require('../../services/LoggerService');

// In-memory rate limit to avoid spamming reminders per channel
const lastReminderAt = new Collection(); // key: channelId, value: Date

// 2 weeks in milliseconds
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Determine if a channel is inactive based on last message timestamp.
 * Tries cache first; if unknown, fetches the most recent message.
 * If it still cannot determine safely, returns false (skip) to avoid spam.
 * @param {import('discord.js').TextChannel} channel
 * @param {number} inactivityMs
 */
async function isChannelInactive(channel, inactivityMs) {
  const now = Date.now();
  let lastTs = channel.lastMessage?.createdTimestamp
    || (channel.lastMessageId && channel.messages?.cache?.get(channel.lastMessageId)?.createdTimestamp)
    || null;

  if (!lastTs) {
    try {
      const msgs = await channel.messages.fetch({ limit: 1 });
      const last = msgs.first();
      lastTs = last?.createdTimestamp || null;
    } catch (_) {
      // On error fetching, skip (treat as unknown)
      lastTs = null;
    }
  }

  if (!lastTs) return false; // Unknown = skip
  return now - lastTs >= inactivityMs;
}

/**
 * Send a reminder message in English with mentions
 */
async function sendReminder(channel, content) {
  try {
    await channel.send({ content });
  } catch (_) {}
}

/**
 * Build reminder content for a wager ticket channel
 */
async function buildWagerReminder(ticket) {
  const mentions = await getWagerMentions(ticket);
  const base = `${mentions.join(' ')}\nThis ticket has been inactive for some time. Please continue the conversation or close the ticket if it has been resolved.`;
  const hint = 'Tips: a moderator/hoster can use the panel buttons or the /closeticket command. It\'s also possible to add someone with /ticketadd.';
  return `${base}\n${hint}`;
}

/**
 * Build reminder content for a war ticket channel
 */
async function buildWarReminder(warDoc) {
  const mentions = await getWarMentions(warDoc);
  const base = `${mentions.join(' ')}\nThis war ticket has been inactive for some time. Do you want to proceed with the scheduling/decision or close the ticket?`;
  const hint = 'Tips: use the war panel buttons or /closeticket. If needed, a moderator can add someone with /ticketadd.';
  return `${base}\n${hint}`;
}

/**
 * Scan all open tickets and send reminders for inactive ones
 * @param {import('discord.js').Client} client
 * @param {{inactivityMinutes?: number, cooldownMinutes?: number}} options
 */
async function scanInactiveTickets(client, options = {}) {
  const inactivityMinutes = options.inactivityMinutes ?? 24 * 60; // default 24h
  const cooldownMinutes = options.cooldownMinutes ?? 180; // default 3h between reminders per channel
  const inactivityMs = inactivityMinutes * 60 * 1000;
  const cooldownMs = cooldownMinutes * 60 * 1000;

  const guilds = client.guilds.cache;
  for (const [, g] of guilds) {
    // Fetch open wars and wagers with channelId
    const [wars, wagers] = await Promise.all([
      War.find({ discordGuildId: g.id, channelId: { $ne: null }, status: { $in: ['aberta'] } }),
      WagerTicket.find({ discordGuildId: g.id, channelId: { $ne: null }, status: 'open' }),
    ]).catch(() => [[], []]);

    // Process wars
    for (const war of wars) {
      const channel = g.channels.cache.get(war.channelId);
      if (!channel) continue;
      const lastAt = lastReminderAt.get(channel.id) || 0;
      if (Date.now() - lastAt < cooldownMs) continue;
      if (!(await isChannelInactive(channel, inactivityMs))) continue;
      const content = await buildWarReminder(war);
      await sendReminder(channel, content);
      lastReminderAt.set(channel.id, Date.now());
    }

    // Process wagers
    for (const w of wagers) {
      const channel = g.channels.cache.get(w.channelId);
      if (!channel) continue;
      const lastAt = lastReminderAt.get(channel.id) || 0;
      if (Date.now() - lastAt < cooldownMs) continue;
      if (!(await isChannelInactive(channel, inactivityMs))) continue;
      const content = await buildWagerReminder(w);
      await sendReminder(channel, content);
      lastReminderAt.set(channel.id, Date.now());
    }
  }
}

/**
 * Schedule periodic scanning
 * @param {import('discord.js').Client} client
 * @param {{intervalMinutes?: number, inactivityMinutes?: number, cooldownMinutes?: number}} options
 */
function scheduleInactiveTicketMonitor(client, options = {}) {
  const intervalMinutes = options.intervalMinutes ?? 30; // run every 30 min
  const intervalMs = intervalMinutes * 60 * 1000;

  // run once after ready + set interval
  setTimeout(() => scanInactiveTickets(client, options).catch(() => {}), 60 * 1000);
  setInterval(() => scanInactiveTickets(client, options).catch(() => {}), intervalMs);
}

/**
 * Check if a wager ticket is older than 2 weeks and still open
 * @param {Object} ticket - WagerTicket document
 * @returns {boolean}
 */
function isTicketExpired(ticket) {
  if (!ticket || !ticket.createdAt) return false;
  const createdAt = new Date(ticket.createdAt).getTime();
  return Date.now() - createdAt >= TWO_WEEKS_MS;
}

/**
 * Apply automatic dodge to the opponent (challenged user) for an expired wager ticket
 * @param {import('discord.js').Client} client
 * @param {Object} ticket - WagerTicket document
 * @param {import('discord.js').Guild} guild - Discord guild
 */
async function applyAutoDodge(client, ticket, guild) {
  const channel = guild.channels.cache.get(ticket.channelId);

  // The opponent (challenged user) is the one who gets the auto-dodge
  const dodgerUserId = ticket.opponentUserId;
  const opponentId = ticket.initiatorUserId;

  // Mark ticket as dodge
  ticket.status = 'dodge';
  ticket.dodgedByUserId = dodgerUserId;
  ticket.closedAt = new Date();
  ticket.closedByUserId = client.user.id; // Bot is the closer
  await ticket.save();

  // Fetch user info for the embed
  let dodgerUser = null, opponentUser = null;
  try {
    [dodgerUser, opponentUser] = await Promise.all([
      client.users.fetch(dodgerUserId).catch(() => null),
      client.users.fetch(opponentId).catch(() => null)
    ]);
  } catch (_) {}

  // Send notification in the ticket channel (if it exists)
  if (channel && channel.type === ChannelType.GuildText) {
    try {
      // Send auto-dodge notification message
      await channel.send({
        content: `⏰ **Auto-Dodge Applied**\n\nThis wager ticket has been open for over 2 weeks without resolution.\n\n<@${dodgerUserId}> has been automatically marked as dodging against <@${opponentId}>.\n\nGenerating transcript and closing ticket...`
      });

      // Build and send the dodge embed
      const { container, attachment } = await buildWagerDodgeEmbed(dodgerUser, opponentUser, client.user.id, new Date());

      // Send container with attachment in same message for attachment:// to work
      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        files: attachment ? [attachment] : []
      });

      // Send transcript to logs
      try {
        await sendTranscriptToLogs(
          guild,
          channel,
          `Wager Ticket ${ticket._id} auto-closed (2 weeks timeout) - Dodge applied to <@${dodgerUserId}>`,
          ticket
        );
      } catch (err) {
        LoggerService.warn('Failed to send auto-dodge transcript:', { error: err?.message });
      }

      // Send log to wager dodge channel if configured
      await sendWagerDodgeLog(
        guild,
        dodgerUser,
        opponentUser,
        client.user.id,
        '⏰ **Auto-Dodge** (2 weeks timeout)'
      );

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          await channel.delete('Wager ticket auto-closed due to 2 weeks inactivity (auto-dodge)');
        } catch (err) {
          console.warn('Failed to delete expired wager ticket channel:', err?.message);
        }
      }, 10000); // 10 seconds delay

    } catch (err) {
      console.error('Error sending auto-dodge notification:', err);
    }
  }

  LoggerService.info(`[Auto-Dodge] Applied to wager ticket ${ticket._id}`, { dodgerUserId });
}

/**
 * Scan for wager tickets that are open for more than 2 weeks and apply auto-dodge
 * @param {import('discord.js').Client} client
 */
async function scanExpiredWagerTickets(client) {
  const guilds = client.guilds.cache;

  for (const [, guild] of guilds) {
    try {
      // Find open wager tickets
      const openWagers = await WagerTicket.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'open'
      }).catch(() => []);

      for (const ticket of openWagers) {
        if (isTicketExpired(ticket)) {
          try {
            await applyAutoDodge(client, ticket, guild);
          } catch (err) {
            LoggerService.error(`[Auto-Dodge] Error processing ticket ${ticket._id}:`, err);
          }
        }
      }
    } catch (err) {
      LoggerService.error(`[Auto-Dodge] Error scanning guild ${guild.id}:`, err);
    }
  }
}

/**
 * Schedule automatic dodge for wager tickets open for more than 2 weeks
 * Runs every hour to check for expired tickets
 * @param {import('discord.js').Client} client
 */
function scheduleAutoDodgeMonitor(client) {
  const intervalMs = 60 * 60 * 1000; // 1 hour

  // Run once after 2 minutes (give time for bot to fully start)
  setTimeout(() => scanExpiredWagerTickets(client).catch(err => {
    LoggerService.error('[Auto-Dodge] Scan error:', err);
  }), 2 * 60 * 1000);

  // Then run every hour
  setInterval(() => scanExpiredWagerTickets(client).catch(err => {
    LoggerService.error('[Auto-Dodge] Scan error:', err);
  }), intervalMs);

  LoggerService.info('[Auto-Dodge] Monitor scheduled - checking every hour for tickets open > 2 weeks');
}

module.exports = {
  scheduleInactiveTicketMonitor,
  scanInactiveTickets,
  scheduleAutoDodgeMonitor,
  scanExpiredWagerTickets
};

