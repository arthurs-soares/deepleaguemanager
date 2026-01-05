const { Collection } = require('discord.js');
const War = require('../../models/war/War');
const WagerTicket = require('../../models/wager/WagerTicket');
const { getWagerMentions, getWarMentions } = require('./participants');

// Re-export from specialized modules
const {
  scheduleAutoDodgeMonitor,
  scanExpiredWagerTickets
} = require('./wagerAutoClose');

const {
  scheduleWarInactivityMonitor,
  scanInactiveWarTickets
} = require('./warInactivityMonitor');

// Rate limit collection for reminders
const lastReminderAt = new Collection();

/**
 * Check channel inactivity
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
 * Send a reminder message
 */
async function sendReminder(channel, content) {
  try {
    await channel.send({ content });
  } catch (_) { }
}

/**
 * Build reminder for wager ticket
 */
async function buildWagerReminder(ticket) {
  const mentions = await getWagerMentions(ticket);
  const base = `${mentions.join(' ')}\nThis ticket has been inactive. ` +
    `Please continue or close if resolved.`;
  const hint = 'Tips: use panel buttons or /closeticket. ' +
    'Add someone with /ticketadd.';
  return `${base}\n${hint}`;
}

/**
 * Build reminder for war ticket
 */
async function buildWarReminder(warDoc) {
  const mentions = await getWarMentions(warDoc);
  const base = `${mentions.join(' ')}\nThis war ticket has been inactive. ` +
    `Proceed with scheduling or close if done.`;
  const hint = 'Tips: use war panel or /closeticket.';
  return `${base}\n${hint}`;
}

/**
 * Scan all open tickets and send reminders
 * @param {import('discord.js').Client} client
 * @param {Object} options
 */
async function scanInactiveTickets(client, options = {}) {
  const inactivityMinutes = options.inactivityMinutes ?? 24 * 60;
  const cooldownMinutes = options.cooldownMinutes ?? 180;
  const inactivityMs = inactivityMinutes * 60 * 1000;
  const cooldownMs = cooldownMinutes * 60 * 1000;

  const guilds = client.guilds.cache;
  for (const [, g] of guilds) {
    const [wars, wagers] = await Promise.all([
      War.find({
        discordGuildId: g.id,
        channelId: { $ne: null },
        status: { $in: ['aberta'] }
      }),
      WagerTicket.find({
        discordGuildId: g.id,
        channelId: { $ne: null },
        status: 'open'
      }),
    ]).catch(() => [[], []]);

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
 * Schedule periodic inactive ticket scanning
 * @param {import('discord.js').Client} client
 * @param {Object} options
 */
function scheduleInactiveTicketMonitor(client, options = {}) {
  const intervalMinutes = options.intervalMinutes ?? 30;
  const intervalMs = intervalMinutes * 60 * 1000;

  setTimeout(() => scanInactiveTickets(client, options).catch(() => { }),
    60 * 1000);
  setInterval(() => scanInactiveTickets(client, options).catch(() => { }),
    intervalMs);
}

module.exports = {
  scheduleInactiveTicketMonitor,
  scanInactiveTickets,
  scheduleAutoDodgeMonitor,
  scanExpiredWagerTickets,
  scheduleWarInactivityMonitor,
  scanInactiveWarTickets
};

