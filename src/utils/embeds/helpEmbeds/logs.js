const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');

function buildLogsEmbed() {
  const container = new ContainerBuilder();

  // Set accent color
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent('# 🧾 Logs and Audit');
  const descText = new TextDisplayBuilder()
    .setContent('The bot records important events in a configurable logs channel via `/config` → Channels → Set Logs Channel.');

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Coverage
  const coverageText = new TextDisplayBuilder()
    .setContent(
      '**Coverage**\n' +
      '- Commands: name, parameters, user, timestamp, results, errors, ' +
      'and before/after for data changes\n' +
      '- Wars: creation, acceptance/dodge and completion\n' +
      '- Administrative actions (audit)'
    );
  container.addTextDisplayComponents(coverageText);

  // DM Warnings
  const dmWarningsText = new TextDisplayBuilder()
    .setContent(
      '**DM Warnings**\n' +
      'Configure a dedicated channel via `/config` → Channels → Set DM Warning Channel. If the bot cannot DM a user (privacy closed), it automatically creates a PRIVATE THREAD in this channel, mentions moderators/admins and the user, and posts the original message with its buttons/actions.'
    );
  container.addTextDisplayComponents(dmWarningsText);

  // Notes
  const notesText = new TextDisplayBuilder()
    .setContent(
      '**Notes**\n' +
      'Hosters are only mentioned ONCE, when the war is ACCEPTED. Before that, only leaders/co-leaders are mentioned.\n' +
      'Also set the Tickets Channel and Category for war channel creation in `/config` → Channels.'
    );
  container.addTextDisplayComponents(notesText);

  return container;
}

module.exports = { buildLogsEmbed };

