const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { SeparatorSpacingSize } = require('discord.js');
const { colors, emojis } = require('../../../config/botConfig');

function buildWarSystemEmbed() {
  const container = new ContainerBuilder();

  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.swords} War System`);
  const descText = new TextDisplayBuilder()
    .setContent('War ticket flow and management.');

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(
    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
  );

  const ticketsText = new TextDisplayBuilder()
    .setContent(
      '**War Tickets**\n' +
      `${emojis.ticket} Wars are created in the category set in \`/config\`. ` +
      'The panel has buttons to declare winner, mark dodge and close.'
    );
  container.addTextDisplayComponents(ticketsText);

  const closeText = new TextDisplayBuilder()
    .setContent(
      '**Closing Tickets**\n' +
      'Use `/ticket close` or the panel button. A transcript is saved.'
    );
  container.addTextDisplayComponents(closeText);

  const dodgeText = new TextDisplayBuilder()
    .setContent(
      '**Dodge Flow**\n' +
      'Hosters/Mods can mark dodge via panel. Configure the War Dodge ' +
      'Channel in `/config` → Channels.'
    );
  container.addTextDisplayComponents(dodgeText);

  const adminText = new TextDisplayBuilder()
    .setContent(
      '**Admin Commands:**\n' +
      '`/admin war mark-dodge` — Mark war as dodge\n' +
      '`/admin war undo-dodge` — Undo dodge\n' +
      '`/admin war revert-result` — Revert result'
    );
  container.addTextDisplayComponents(adminText);

  return container;
}

module.exports = { buildWarSystemEmbed };

