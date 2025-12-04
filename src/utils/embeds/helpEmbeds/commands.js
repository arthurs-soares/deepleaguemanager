const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { SeparatorSpacingSize } = require('discord.js');
const { colors, emojis } = require('../../../config/botConfig');

/**
 * Build the commands help embed with organized structure
 * @param {Client} _client - Discord client (unused, kept for compatibility)
 * @returns {ContainerBuilder}
 */
function buildCommandsEmbed(_client) {
  const container = new ContainerBuilder();

  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.commands} Commands Reference`);
  const descText = new TextDisplayBuilder()
    .setContent('All commands organized by domain.');

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Guild commands
  const guildText = new TextDisplayBuilder()
    .setContent(
      '### 🏰 Guild\n' +
      '`/guild panel` — View your guild panel\n' +
      '`/guild view` — List all guilds\n' +
      '`/guild register` — Register a new guild\n' +
      '`/guild delete` — Delete a guild\n' +
      '`/guild set-score` — Set W/L score'
    );
  container.addTextDisplayComponents(guildText);

  // Wager commands
  const wagerText = new TextDisplayBuilder()
    .setContent(
      '### 🎲 Wager\n' +
      '`/wager stats` — View wager statistics\n' +
      '`/wager leaderboard` — Wager rankings'
    );
  container.addTextDisplayComponents(wagerText);

  // User commands
  const userText = new TextDisplayBuilder()
    .setContent(
      '### 👤 User\n' +
      '`/user profile` — View user profile\n' +
      '`/user fix-guild` — Fix guild associations\n' +
      '`/user reset-ratings` — Reset all ELO ratings'
    );
  container.addTextDisplayComponents(userText);

  // Ticket commands
  const ticketText = new TextDisplayBuilder()
    .setContent(
      '### 🎫 Ticket\n' +
      '`/ticket close` — Close current ticket\n' +
      '`/ticket add-user` — Add user to ticket'
    );
  container.addTextDisplayComponents(ticketText);

  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  // Admin commands
  const adminText = new TextDisplayBuilder()
    .setContent(
      '### 🛡️ Admin\n' +
      '`/admin war` — War administration\n' +
      '`/admin wager` — Wager administration\n' +
      '`/admin system` — System management\n' +
      '`/cooldown` — Manage user cooldowns\n' +
      '`/leaderboard refresh` — Refresh leaderboards\n' +
      '`/event point` — Manage event points\n' +
      '`/config` — Server configuration'
    );
  container.addTextDisplayComponents(adminText);

  // General commands
  const generalText = new TextDisplayBuilder()
    .setContent(
      '### � General\n' +
      '`/help` — Show this help menu\n' +
      '`/ping` — Check bot latency\n' +
      '`/support` — Get support info'
    );
  container.addTextDisplayComponents(generalText);

  return container;
}

module.exports = { buildCommandsEmbed };

