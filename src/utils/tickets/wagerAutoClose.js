const { MessageFlags, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const WagerTicket = require('../../models/wager/WagerTicket');
const { buildWagerDodgeEmbed } = require('../embeds/wagerDodgeEmbed');
const { sendWagerDodgeLog } = require('./wagerDodgeLog');
const { sendTranscriptToLogs } = require('./transcript');
const LoggerService = require('../../services/LoggerService');

const ONE_DAY_MS = 1 * 24 * 60 * 60 * 1000;
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/** Check if unaccepted ticket expired (1 day) */
function isTicketExpired(ticket) {
  if (!ticket?.createdAt || ticket.acceptedAt) return false;
  return Date.now() - new Date(ticket.createdAt).getTime() >= ONE_DAY_MS;
}

/** Check if accepted ticket expired (3 days without result) */
function isAcceptedTicketExpired(ticket) {
  if (!ticket?.acceptedAt || ticket.status !== 'open') return false;
  const refTime = Math.max(
    new Date(ticket.acceptedAt).getTime(),
    ticket.inactivityReactivatedAt
      ? new Date(ticket.inactivityReactivatedAt).getTime() : 0
  );
  return Date.now() - refTime >= THREE_DAYS_MS;
}

/** Check if ticket needs inactivity warning (2 days) */
function isWagerTicketInactiveForWarning(ticket) {
  if (!ticket?.acceptedAt || ticket.status !== 'open') return false;
  if (ticket.lastInactivityWarningAt) return false;
  const refTime = Math.max(
    new Date(ticket.acceptedAt).getTime(),
    ticket.inactivityReactivatedAt
      ? new Date(ticket.inactivityReactivatedAt).getTime() : 0
  );
  return Date.now() - refTime >= TWO_DAYS_MS;
}

/**
 * Apply automatic dodge for an accepted ticket that expired
 * @param {import('discord.js').Client} client
 * @param {Object} ticket - WagerTicket document
 * @param {import('discord.js').Guild} guild
 */
async function applyAutoDodgeForAcceptedTicket(client, ticket, guild) {
  const channel = guild.channels.cache.get(ticket.channelId);

  const dodgerUserId = ticket.opponentUserId;
  const opponentId = ticket.initiatorUserId;

  ticket.status = 'closed';
  ticket.dodgedByUserId = dodgerUserId;
  ticket.closedAt = new Date();
  ticket.closedByUserId = client.user.id;
  await ticket.save();

  let dodgerUser = null, opponentUser = null;
  try {
    [dodgerUser, opponentUser] = await Promise.all([
      client.users.fetch(dodgerUserId).catch(() => null),
      client.users.fetch(opponentId).catch(() => null)
    ]);
  } catch (_) { }

  if (channel && channel.type === ChannelType.GuildText) {
    try {
      await channel.send({
        content: `⏰ **Auto-Dodge Applied (3 Days Timeout)**\n\n` +
          `This wager was accepted but the game never happened.\n\n` +
          `<@${dodgerUserId}> has been marked as dodging.\n\n` +
          `Generating transcript and closing ticket...`
      });

      const { container, attachment } = await buildWagerDodgeEmbed(
        dodgerUser, opponentUser, client.user.id, new Date()
      );

      await channel.send({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        files: attachment ? [attachment] : []
      });

      try {
        await sendTranscriptToLogs(
          guild,
          channel,
          `Wager Ticket ${ticket._id} auto-closed - Dodge applied`,
          ticket
        );
      } catch (err) {
        LoggerService.warn('Failed to send auto-dodge transcript:', {
          error: err?.message
        });
      }

      await sendWagerDodgeLog(guild, dodgerUser, opponentUser, client.user.id);

      setTimeout(async () => {
        try {
          await channel.delete('Auto-dodge: 3 days after acceptance');
        } catch (err) {
          LoggerService.warn('Failed to delete channel:', { error: err?.message });
        }
      }, 10000);

    } catch (err) {
      LoggerService.error('Error sending auto-dodge notification:', { error: err });
    }
  }

  LoggerService.info(`[Auto-Dodge] Applied to ticket ${ticket._id}`, {
    dodgerUserId
  });
}

/**
 * Auto-close an unaccepted wager ticket after 1 day (NO dodge)
 * @param {import('discord.js').Client} client
 * @param {Object} ticket - WagerTicket document
 * @param {import('discord.js').Guild} guild
 */
async function autoCloseUnacceptedTicket(client, ticket, guild) {
  const channel = guild.channels.cache.get(ticket.channelId);

  const initiatorId = ticket.initiatorUserId;
  const opponentId = ticket.opponentUserId;

  ticket.status = 'closed';
  ticket.closedAt = new Date();
  ticket.closedByUserId = client.user.id;
  await ticket.save();

  if (channel && channel.type === ChannelType.GuildText) {
    try {
      await channel.send({
        content: `⏰ **Ticket Auto-Closed**\n\n` +
          `This ticket was open for 24h without being accepted.\n\n` +
          `<@${initiatorId}> vs <@${opponentId}>\n\n` +
          `Generating transcript...`
      });

      try {
        await sendTranscriptToLogs(
          guild,
          channel,
          `Wager Ticket ${ticket._id} auto-closed (24h unaccepted)`,
          ticket
        );
      } catch (err) {
        LoggerService.warn('Failed to send auto-close transcript:', {
          error: err?.message
        });
      }

      setTimeout(async () => {
        try {
          await channel.delete('Auto-closed: 24h unaccepted');
        } catch (err) {
          LoggerService.warn('Failed to delete channel:', { error: err?.message });
        }
      }, 10000);

    } catch (err) {
      LoggerService.error('Error sending auto-close notification:', { error: err });
    }
  }

  LoggerService.info(`[Auto-Close] Unaccepted ticket ${ticket._id} closed`);
}

/** Send 24h warning for auto-dodge (at 48h mark) */
async function sendWagerInactivityWarning(client, ticket, guild) {
  const channel = guild.channels.cache.get(ticket.channelId);
  if (!channel) return;

  try {
    const extendButton = new ButtonBuilder()
      .setCustomId(`wager:extend:${ticket._id}`)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Extend Ticket (+3 days)')
      .setEmoji('⏰');

    await channel.send({
      content: `⚠️ **Wager Ticket Inactivity Warning**\n\n` +
        `Open for **48 hours** without result.\n` +
        `Auto-dodge applies in **24 hours** if no action.\n` +
        `Click below to extend.`,
      components: [new ActionRowBuilder().addComponents(extendButton)]
    });

    ticket.lastInactivityWarningAt = new Date();
    await ticket.save();
    LoggerService.info(`[Wager Warning] Sent for ticket ${ticket._id}`);
  } catch (err) {
    LoggerService.error(`[Wager Warning] Error: ${ticket._id}:`, err);
  }
}

/**
 * Scan for expired wager tickets
 * @param {import('discord.js').Client} client
 */
async function scanExpiredWagerTickets(client) {
  const guilds = client.guilds.cache;

  for (const [, guild] of guilds) {
    try {
      // 1. Unaccepted tickets (1 day - just close)
      const unaccepted = await WagerTicket.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'open',
        acceptedAt: null
      }).catch(() => []);

      for (const ticket of unaccepted) {
        if (isTicketExpired(ticket)) {
          try {
            await autoCloseUnacceptedTicket(client, ticket, guild);
          } catch (err) {
            LoggerService.error(`[Auto-Close] Error: ${ticket._id}:`, err);
          }
        }
      }

      // 2. Accepted tickets (3 day - apply dodge)
      const accepted = await WagerTicket.find({
        discordGuildId: guild.id,
        channelId: { $ne: null },
        status: 'open',
        acceptedAt: { $ne: null }
      }).catch(() => []);

      for (const ticket of accepted) {
        if (isAcceptedTicketExpired(ticket)) {
          try {
            await applyAutoDodgeForAcceptedTicket(client, ticket, guild);
          } catch (err) {
            LoggerService.error(`[Auto-Dodge] Error: ${ticket._id}:`, err);
          }
        } else if (isWagerTicketInactiveForWarning(ticket)) {
          try {
            await sendWagerInactivityWarning(client, ticket, guild);
          } catch (err) {
            LoggerService.error(`[Auto-Warning] Error: ${ticket._id}:`, err);
          }
        }
      }
    } catch (err) {
      LoggerService.error(`[Auto-Close/Dodge] Guild ${guild.id}:`, err);
    }
  }
}

/**
 * Schedule automatic close/dodge for wager tickets
 * @param {import('discord.js').Client} client
 */
function scheduleAutoDodgeMonitor(client) {
  const intervalMs = 60 * 60 * 1000; // 1 hour

  setTimeout(() => scanExpiredWagerTickets(client).catch(err => {
    LoggerService.error('[Auto-Close/Dodge] Scan error:', err);
  }), 2 * 60 * 1000);

  setInterval(() => scanExpiredWagerTickets(client).catch(err => {
    LoggerService.error('[Auto-Close/Dodge] Scan error:', err);
  }), intervalMs);

  LoggerService.info('[Auto-Close/Dodge] Monitor scheduled - every hour');
}

module.exports = {
  scheduleAutoDodgeMonitor,
  scanExpiredWagerTickets,
  isTicketExpired,
  isAcceptedTicketExpired
};
