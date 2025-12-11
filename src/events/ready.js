const { Events } = require('discord.js');
const { scheduleAutoSync } = require('../utils/system/autoSync');
const { scheduleDailyLeaderboard } = require('../utils/user/leaderboard');
const {
  scheduleDailyWagerLeaderboard
} = require('../utils/wager/wagerLeaderboard');
const {
  scheduleInactiveTicketMonitor,
  scheduleAutoDodgeMonitor,
  scheduleWarInactivityMonitor
} = require('../utils/tickets/inactivityMonitor');
const LoggerService = require('../services/LoggerService');

module.exports = {
  name: Events.ClientReady,
  once: true,

  /**
   * Execute when bot is ready
   * @param {Client} client - Discord client instance
   */
  async execute(client) {
    LoggerService.info(`Bot ready! Logged in as ${client.user.tag}`, {
      servers: client.guilds.cache.size,
      users: client.users.cache.size
    });

    // Set bot activity
    client.user.setActivity('managing guilds', { type: 'PLAYING' });

    // Schedule automatic synchronization
    try {
      scheduleAutoSync(client);
    } catch (err) {
      LoggerService.error('Failed to schedule AutoSync:', { error: err?.message });
    }

    // Schedule hourly leaderboard updates
    try {
      scheduleDailyLeaderboard(client);
    } catch (err) {
      LoggerService.error('Failed to schedule Leaderboard:', { error: err?.message });
    }

    // Schedule hourly wager leaderboard updates
    try {
      scheduleDailyWagerLeaderboard(client);
    } catch (err) {
      LoggerService.error('Failed to schedule Wager Leaderboard:', {
        error: err?.message
      });
    }

    // Inactive ticket monitor (inactive >= 36h, reminder every 3h, scan every 30min)
    try {
      scheduleInactiveTicketMonitor(client, {
        intervalMinutes: 30,
        inactivityMinutes: 36 * 60,
        cooldownMinutes: 180
      });
    } catch (err) {
      LoggerService.error('Failed to schedule inactive ticket monitor:', {
        error: err?.message
      });
    }

    // Auto-dodge monitor: applies dodge to wager tickets open for more than 1 day
    // The challenged user (opponent) receives the dodge automatically
    try {
      scheduleAutoDodgeMonitor(client);
    } catch (err) {
      LoggerService.error('Failed to schedule auto-dodge monitor:', {
        error: err?.message
      });
    }

    // War ticket inactivity monitor: sends warning after 7 days of inactivity
    // with reactivation button for hosters
    try {
      scheduleWarInactivityMonitor(client);
    } catch (err) {
      LoggerService.error('Failed to schedule war inactivity monitor:', {
        error: err?.message
      });
    }
  }
};
