const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../../config/botConfig');

function buildWarSystemEmbed() {
  const container = new ContainerBuilder();

  // Set accent color
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent('# ⚔️ War System');
  const descText = new TextDisplayBuilder()
    .setContent('Ticket flow and war-related functionalities.');

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // War Tickets
  const ticketsText = new TextDisplayBuilder()
    .setContent(
      '**War Tickets**\n' +
      'War channels are created in the category defined in `/config` → Channels. The war panel centralizes actions. When a war is accepted, the bot pins a control message in the ticket channel with buttons to declare winner, mark dodge and close the ticket. Only Hosters/Moderators/Admins can use them.'
    );
  container.addTextDisplayComponents(ticketsText);

  // Close War Ticket
  const closeText = new TextDisplayBuilder()
    .setContent(
      '**Close War Ticket**\n' +
      `${emojis.ticket} After the war is ACCEPTED, the panel will have the "Close Ticket" button. Only Hosters/Moderators/Admins can use it. You can also use \`/closeticket\` inside the ticket channel. When closed, the channel is deleted and a log is sent to the logs channel. A full transcript (messages, authors, timestamps) is automatically saved to the logs channel before deletion. After declaring the winner, the "Close + Transcript" button is also posted automatically in the channel.`
    );
  container.addTextDisplayComponents(closeText);

  // Inactivity Reminders
  const inactivityText = new TextDisplayBuilder()
    .setContent(
      '**Inactivity Reminders**\n' +
      'The bot sends automatic reminders in English when a war ticket becomes inactive (e.g.: 36h without messages). Guild leaders/co-leaders are mentioned. There is a cooldown between reminders to avoid spam.'
    );
  container.addTextDisplayComponents(inactivityText);

  // Dodge Flow
  const dodgeText = new TextDisplayBuilder()
    .setContent(
      '**Dodge Flow**\n' +
      'Only Hosters/Moderators can mark a war as Dodge using the Dodge ' +
      'button. They must select which guild dodged and confirm. ' +
      'Configure the War Dodge Channel in `/config` → Channels ' +
      'to receive automatic notifications.'
    );
  container.addTextDisplayComponents(dodgeText);

  // Admin War Commands
  const adminText = new TextDisplayBuilder()
    .setContent(
      '**Admin War Commands**\n' +
      '`/admin war mark-dodge`, `/admin war undo-dodge`, ' +
      '`/admin war revert-result`'
    );
  container.addTextDisplayComponents(adminText);

  return container;
}

module.exports = { buildWarSystemEmbed };

