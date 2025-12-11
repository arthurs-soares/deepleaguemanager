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

// 1 day in milliseconds (for unaccepted tickets)
const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;

// 3 days in milliseconds (for accepted tickets without wager completion)
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// 7 days in milliseconds (for war ticket inactivity warning)
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
  } catch (_) { }
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
  setTimeout(() => scanInactiveTickets(client, options).catch(() => { }), 60 * 1000);
  setInterval(() => scanInactiveTickets(client, options).catch(() => { }), intervalMs);
}

/**
 * Check if a wager ticket is older than 1 day and still unaccepted
 * @param {Object} ticket - WagerTicket document
 * @returns {boolean}
 */
function isTicketExpired(ticket) {
  if (!ticket || !ticket.createdAt) return false;
  // If user accepted, it doesn't auto-expire via this check (game started)
  if (ticket.acceptedAt) return false;

  const createdAt = new Date(ticket.createdAt).getTime();
  return Date.now() - createdAt >= ONE_DAY_MS;
}

/**
 * Check if an ACCEPTED wager ticket has been open for more than 3 days without completion
 * This means the wager was accepted but the game never happened
 * @param {Object} ticket - WagerTicket document
 * @returns {boolean}
 */
function isAcceptedTicketExpired(ticket) {
  if (!ticket || !ticket.acceptedAt) return false;
  // Only check tickets that were accepted but not closed
  if (ticket.status !== 'open') return false;

  const acceptedAt = new Date(ticket.acceptedAt).getTime();
  return Date.now() - acceptedAt >= THREE_DAYS_MS;
}

/**
 * Apply automatic dodge for an accepted ticket that expired (3 days without game happening)
 * In this case, both users are at fault, but we apply dodge to the opponent (challenged user)
 * @param {import('discord.js').Client} client
 * @param {Object} ticket - WagerTicket document
 * @param {import('discord.js').Guild} guild - Discord guild
 */
async function applyAutoDodgeForAcceptedTicket(client, ticket, guild) {
  const channel = guild.channels.cache.get(ticket.channelId);

  // The opponent (challenged user) is the one who gets the auto-dodge
  // since they accepted but the game never happened
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
  } catch (_) { }

  // Send notification in the ticket channel (if it exists)
  if (channel && channel.type === ChannelType.GuildText) {
    try {
      // Send auto-dodge notification message
      await channel.send({
        content: `⏰ **Auto-Dodge Applied (3 Days Timeout)**\n\nThis wager was accepted but the game never happened within 3 days.\n\n<@${dodgerUserId}> has been automatically marked as dodging against <@${opponentId}>.\n\nGenerating transcript and closing ticket...`
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
          `Wager Ticket ${ticket._id} auto-closed (3 days after acceptance without game) - Dodge applied to <@${dodgerUserId}>`,
          ticket
        );
      } catch (err) {
        LoggerService.warn('Failed to send auto-dodge transcript (accepted ticket):', { error: err?.message });
      }

      // Send log to wager dodge channel if configured
      await sendWagerDodgeLog(
        guild,
        dodgerUser,
        opponentUser,
        client.user.id
      );

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          await channel.delete('Wager ticket auto-closed due to 3 days after acceptance without game (auto-dodge)');
        } catch (err) {
          console.warn('Failed to delete expired accepted wager ticket channel:', err?.message);
        }
      }, 10000); // 10 seconds delay

    } catch (err) {
      console.error('Error sending auto-dodge notification (accepted ticket):', err);
    }
  }

  LoggerService.info(`[Auto-Dodge] Applied to ACCEPTED wager ticket ${ticket._id} (3 days timeout)`, { dodgerUserId });
}

/**
 * Auto-close an unaccepted wager ticket after 1 day (NO dodge applied)
 * The ticket is simply closed since the opponent never responded
 * @param {import('discord.js').Client} client
 * @param {Object} ticket - WagerTicket document
 * @param {import('discord.js').Guild} guild - Discord guild
 */
async function autoCloseUnacceptedTicket(client, ticket, guild) {
  const channel = guild.channels.cache.get(ticket.channelId);

  const initiatorId = ticket.initiatorUserId;
  const opponentId = ticket.opponentUserId;

  // Mark ticket as closed (NOT dodge - just closed due to no response)
  ticket.status = 'closed';
  ticket.closedAt = new Date();
  ticket.closedByUserId = client.user.id; // Bot is the closer
  await ticket.save();

  // Send notification in the ticket channel (if it exists)
  if (channel && channel.type === ChannelType.GuildText) {
    try {
      // Send auto-close notification message
      await channel.send({
        content: `⏰ **Ticket Auto-Closed**\n\nThis wager ticket has been open for over 24 hours without being accepted.\n\nThe ticket between <@${initiatorId}> and <@${opponentId}> has been automatically closed.\n\nGenerating transcript and closing ticket...`
      });

      // Send transcript to logs
      try {
        await sendTranscriptToLogs(
          guild,
          channel,
          `Wager Ticket ${ticket._id} auto-closed (24 hours without acceptance)`,
          ticket
        );
      } catch (err) {
        LoggerService.warn('Failed to send auto-close transcript:', { error: err?.message });
      }

      // Delete the channel after a short delay
      setTimeout(async () => {
        try {
          await channel.delete('Wager ticket auto-closed due to 24 hours without acceptance');
        } catch (err) {
          console.warn('Failed to delete unaccepted wager ticket channel:', err?.message);
        }
      }, 10000); // 10 seconds delay

    } catch (err) {
      console.error('Error sending auto-close notification:', err);
    }
  }

  LoggerService.info(`[Auto-Close] Unaccepted wager ticket ${ticket._id} closed after 1 day`);
}

/**
 * Scan for wager tickets that are:
 * 1. Open for more than 1 day and NOT accepted (auto-close without dodge)
 * 2. Accepted but open for more than 3 days without game happening (apply auto-dodge)
 * @param {import('discord.js').Client} client
 */
async function scanExpiredWagerTickets(client) {
  const guilds = client.guilds.cache;

  for (const [, guild] of guilds) {
    try {
      // 1. Find open wager tickets that are NOT accepted yet (1 day timeout - just close, no dodge)
      const unacceptedWagers = await WagerTicket.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'open',
        acceptedAt: null // ensuring we only catch unaccepted wagers
      }).catch(() => []);

      for (const ticket of unacceptedWagers) {
        if (isTicketExpired(ticket)) {
          try {
            await autoCloseUnacceptedTicket(client, ticket, guild);
          } catch (err) {
            LoggerService.error(`[Auto-Close] Error processing unaccepted ticket ${ticket._id}:`, err);
          }
        }
      }

      // 2. Find accepted wager tickets that haven't been closed (3 day timeout - apply dodge)
      const acceptedWagers = await WagerTicket.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'open',
        acceptedAt: { $ne: null } // Only tickets that were accepted
      }).catch(() => []);

      for (const ticket of acceptedWagers) {
        if (isAcceptedTicketExpired(ticket)) {
          try {
            await applyAutoDodgeForAcceptedTicket(client, ticket, guild);
          } catch (err) {
            LoggerService.error(`[Auto-Dodge] Error processing accepted ticket ${ticket._id}:`, err);
          }
        }
      }
    } catch (err) {
      LoggerService.error(`[Auto-Close/Dodge] Error scanning guild ${guild.id}:`, err);
    }
  }
}

/**
 * Schedule automatic close/dodge for wager tickets:
 * - Unaccepted tickets: auto-close after 1 day (NO dodge)
 * - Accepted tickets without game: auto-dodge after 3 days
 * Runs every hour to check for expired tickets
 * @param {import('discord.js').Client} client
 */
function scheduleAutoDodgeMonitor(client) {
  const intervalMs = 60 * 60 * 1000; // 1 hour

  // Run once after 2 minutes (give time for bot to fully start)
  setTimeout(() => scanExpiredWagerTickets(client).catch(err => {
    LoggerService.error('[Auto-Close/Dodge] Scan error:', err);
  }), 2 * 60 * 1000);

  // Then run every hour
  setInterval(() => scanExpiredWagerTickets(client).catch(err => {
    LoggerService.error('[Auto-Close/Dodge] Scan error:', err);
  }), intervalMs);

  LoggerService.info('[Auto-Close/Dodge] Monitor scheduled - checking every hour (unaccepted: close after 1 day, accepted without game: dodge after 3 days)');
}

/**
 * Check if a war ticket is inactive for 7+ days and needs a warning
 * Considers the last message in the channel, last warning sent, or reactivation
 * @param {Object} war - War document
 * @param {import('discord.js').TextChannel} channel - War ticket channel
 * @returns {Promise<boolean>}
 */
async function isWarTicketInactiveFor7Days(war, channel) {
  if (!war || !channel) return false;

  // If status is not 'aberta', skip
  if (war.status !== 'aberta') return false;

  const now = Date.now();

  // Check if ticket was recently reactivated (less than 7 days ago)
  if (war.inactivityReactivatedAt) {
    const reactivatedAt = new Date(war.inactivityReactivatedAt).getTime();
    if (now - reactivatedAt < SEVEN_DAYS_MS) {
      return false;
    }
  }

  // Check if a warning was already sent in the last 7 days
  if (war.lastInactivityWarningAt) {
    const lastWarningAt = new Date(war.lastInactivityWarningAt).getTime();
    if (now - lastWarningAt < SEVEN_DAYS_MS) {
      return false;
    }
  }

  // Check channel inactivity
  const isInactive = await isChannelInactive(channel, SEVEN_DAYS_MS);
  return isInactive;
}

/**
 * Send inactivity warning for a war ticket with reactivation button
 * @param {import('discord.js').Client} client
 * @param {Object} war - War document
 * @param {import('discord.js').TextChannel} channel
 * @param {import('discord.js').Guild} guild
 */
async function sendWarInactivityWarning(client, war, channel, guild) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
  const Guild = require('../../models/guild/Guild');

  try {
    // Get guild names for the message
    const [guildA, guildB] = await Promise.all([
      Guild.findById(war.guildAId).lean().catch(() => null),
      Guild.findById(war.guildBId).lean().catch(() => null)
    ]);

    const guildAName = guildA?.name || 'Guild A';
    const guildBName = guildB?.name || 'Guild B';

    // Build reactivation button
    const reactivateButton = new ButtonBuilder()
      .setCustomId(`war:reactivate:${war._id}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Reactivate Ticket (+7 days)')
      .setEmoji('🔄');

    const actionRow = new ActionRowBuilder().addComponents(reactivateButton);

    // Send warning message
    const warningMessage =
      `⚠️ **War Ticket Inactivity Warning**\n\n` +
      `This war ticket between **${guildAName}** vs **${guildBName}** has been inactive for **7 days**.\n\n` +
      `If no action is taken by a **Hoster**, this ticket will be subject to deletion.\n\n` +
      `Click the button below to reactivate this ticket for another 7 days.`;

    await channel.send({
      content: warningMessage,
      components: [actionRow]
    });

    // Update war document with warning timestamp
    war.lastInactivityWarningAt = new Date();
    await war.save();

    LoggerService.info(`[War Inactivity] Warning sent for war ticket ${war._id}`, {
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
 * Scan for war tickets that have been inactive for 7+ days
 * Sends warning with reactivation button for hosters
 * @param {import('discord.js').Client} client
 */
async function scanInactiveWarTickets(client) {
  const guilds = client.guilds.cache;

  for (const [, guild] of guilds) {
    try {
      // Find open war tickets with a channel
      const openWars = await War.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'aberta'
      }).catch(() => []);

      for (const war of openWars) {
        const channel = guild.channels.cache.get(war.channelId);
        if (!channel) continue;

        // Check if ticket has been inactive for 7+ days
        const needsWarning = await isWarTicketInactiveFor7Days(war, channel);

        if (needsWarning) {
          try {
            await sendWarInactivityWarning(client, war, channel, guild);
          } catch (err) {
            LoggerService.error(`[War Inactivity] Error processing war ${war._id}:`, err);
          }
        }
      }
    } catch (err) {
      LoggerService.error(`[War Inactivity] Error scanning guild ${guild.id}:`, err);
    }
  }
}

/**
 * Schedule automatic inactivity warning for war tickets
 * Sends warning after 7 days of inactivity with reactivation button
 * Runs every 6 hours to check for inactive tickets
 * @param {import('discord.js').Client} client
 */
function scheduleWarInactivityMonitor(client) {
  const intervalMs = 6 * 60 * 60 * 1000; // 6 hours

  // Run once after 3 minutes (give time for bot to fully start)
  setTimeout(() => scanInactiveWarTickets(client).catch(err => {
    LoggerService.error('[War Inactivity] Scan error:', err);
  }), 3 * 60 * 1000);

  // Then run every 6 hours
  setInterval(() => scanInactiveWarTickets(client).catch(err => {
    LoggerService.error('[War Inactivity] Scan error:', err);
  }), intervalMs);

  LoggerService.info('[War Inactivity] Monitor scheduled - checking every 6 hours (warning after 7 days of inactivity)');
}

module.exports = {
  scheduleInactiveTicketMonitor,
  scanInactiveTickets,
  scheduleAutoDodgeMonitor,
  scanExpiredWagerTickets,
  scheduleWarInactivityMonitor,
  scanInactiveWarTickets
};

