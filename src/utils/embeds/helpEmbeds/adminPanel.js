const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../../config/botConfig');

function buildAdminPanelEmbed() {
  const container = new ContainerBuilder();

  // Set accent color
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent('# 🛡️ Administration via Panel');
  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Admins (Administrator permission) or Moderators (defined in \`/config\` → Roles) can use \`/guild panel name:<guild>\` to open and manage ANY guild.`
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Available actions
  const actionsText = new TextDisplayBuilder()
    .setContent(
      '**Available actions**\n' +
      'Edit roster, transfer leadership, edit data, add co-leader, and change co-leader.'
    );
  container.addTextDisplayComponents(actionsText);

  // Roster invitations
  const rosterText = new TextDisplayBuilder()
    .setContent(
      '**Roster invitations**\n' +
      'When adding someone to Main/Sub roster via the panel, the bot sends a DM invitation with two buttons: Join Guild or Don\'t Join. The user must accept to be added. When the user accepts, the inviter receives a DM confirmation.'
    );
  container.addTextDisplayComponents(rosterText);

  // Support Roles Configuration
  const supportText = new TextDisplayBuilder()
    .setContent(
      '**Support Roles Configuration**\n' +
      'Configure one or more Support roles in `/config` → Roles. These roles represent your support staff and can be referenced by other features (e.g., tickets, ModMail, or internal tools).'
    );
  container.addTextDisplayComponents(supportText);

  // Admin Commands
  const adminText = new TextDisplayBuilder()
    .setContent(
      '**Admin Commands (Unified)**\n' +
      'Use `/admin war mark-dodge`, `/admin war undo-dodge`, ' +
      '`/admin war revert-result`, and `/admin wager record`. ' +
      'Legacy commands were consolidated under `/admin`.'
    );
  container.addTextDisplayComponents(adminText);

  return container;
}

module.exports = { buildAdminPanelEmbed };

