const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { SeparatorSpacingSize } = require('discord.js');
const { colors, emojis } = require('../../../config/botConfig');

function buildAdminPanelEmbed() {
  const container = new ContainerBuilder();

  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.admin} Administration Panel`);
  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Admins or Moderators can manage any guild ` +
      'via `/guild panel name:<guild>`.'
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const actionsText = new TextDisplayBuilder()
    .setContent(
      '**Panel Actions:**\n' +
      '• Edit roster (Main/Sub)\n' +
      '• Transfer leadership\n' +
      '• Add/change co-leader\n' +
      '• Edit guild data'
    );
  container.addTextDisplayComponents(actionsText);

  const adminCmdsText = new TextDisplayBuilder()
    .setContent(
      '**Admin Commands:**\n' +
      '`/admin war` — War administration\n' +
      '`/admin wager` — Wager administration\n' +
      '`/admin system` — Sync and DB management\n' +
      '`/config` — Server configuration\n' +
      '`/cooldown` — Manage user cooldowns\n' +
      '`/leaderboard refresh` — Refresh rankings\n' +
      '`/event point` — Event points management'
    );
  container.addTextDisplayComponents(adminCmdsText);

  const userCmdsText = new TextDisplayBuilder()
    .setContent(
      '**User Management:**\n' +
      '`/user fix-guild` — Fix guild associations\n' +
      '`/user reset-ratings` — Reset all ELO ratings'
    );
  container.addTextDisplayComponents(userCmdsText);

  const rolesText = new TextDisplayBuilder()
    .setContent(
      '**Role Configuration:**\n' +
      'Configure Moderators, Hosters and Support roles in `/config` → Roles.'
    );
  container.addTextDisplayComponents(rolesText);

  return container;
}

module.exports = { buildAdminPanelEmbed };

