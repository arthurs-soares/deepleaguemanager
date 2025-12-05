const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');

/**
 * Build participants mention string based on ticket type
 * @param {Object} ticket - WagerTicket document
 * @returns {string}
 */
function buildParticipantsMention(ticket) {
  if (ticket.is2v2) {
    return `<@${ticket.initiatorUserId}> & <@${ticket.initiatorTeammateId}> vs ` +
      `<@${ticket.opponentUserId}> & <@${ticket.opponentTeammateId}>`;
  }
  return `<@${ticket.initiatorUserId}> vs <@${ticket.opponentUserId}>`;
}

/**
 * Get all participant IDs from a ticket
 * @param {Object} ticket - WagerTicket document
 * @returns {string[]}
 */
function getAllParticipantIds(ticket) {
  if (ticket.is2v2) {
    return [
      ticket.initiatorUserId,
      ticket.initiatorTeammateId,
      ticket.opponentUserId,
      ticket.opponentTeammateId
    ];
  }
  return [ticket.initiatorUserId, ticket.opponentUserId];
}

/**
 * Build winner decision panel for accepted wager
 * @param {Object} ticket - WagerTicket document
 * @returns {ContainerBuilder}
 */
function buildWinnerDecisionPanel(ticket) {
  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.depthsWager} Winner Decision`);

  const descText = new TextDisplayBuilder()
    .setContent('Select the winner (Depths). Only Hosters/Moderators can click.');

  const timestampText = new TextDisplayBuilder()
    .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

  container.addTextDisplayComponents(titleText, descText, timestampText);
  container.addSeparatorComponents(new SeparatorBuilder());

  if (ticket.is2v2) {
    addTeamSections(container, ticket);
  } else {
    addSoloSections(container, ticket);
  }

  return container;
}

/**
 * Add 2v2 team sections to container
 * @param {ContainerBuilder} container
 * @param {Object} ticket
 */
function addTeamSections(container, ticket) {
  const teamASection = new SectionBuilder();
  const teamAText = new TextDisplayBuilder()
    .setContent(`**Team A:**\n<@${ticket.initiatorUserId}> & <@${ticket.initiatorTeammateId}>`);
  teamASection.addTextDisplayComponents(teamAText);
  teamASection.setButtonAccessory(button =>
    button
      .setCustomId(`wager:decideWinner:${ticket._id}:initiator:depths`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Team A Won')
  );
  container.addSectionComponents(teamASection);

  const teamBSection = new SectionBuilder();
  const teamBText = new TextDisplayBuilder()
    .setContent(`**Team B:**\n<@${ticket.opponentUserId}> & <@${ticket.opponentTeammateId}>`);
  teamBSection.addTextDisplayComponents(teamBText);
  teamBSection.setButtonAccessory(button =>
    button
      .setCustomId(`wager:decideWinner:${ticket._id}:opponent:depths`)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Team B Won')
  );
  container.addSectionComponents(teamBSection);
}

/**
 * Add 1v1 solo sections to container
 * @param {ContainerBuilder} container
 * @param {Object} ticket
 */
function addSoloSections(container, ticket) {
  const initiatorSection = new SectionBuilder();
  const initiatorText = new TextDisplayBuilder()
    .setContent(`**Initiator:** <@${ticket.initiatorUserId}>`);
  initiatorSection.addTextDisplayComponents(initiatorText);
  initiatorSection.setButtonAccessory(button =>
    button
      .setCustomId(`wager:decideWinner:${ticket._id}:initiator:depths`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Initiator Won')
  );
  container.addSectionComponents(initiatorSection);

  const opponentSection = new SectionBuilder();
  const opponentText = new TextDisplayBuilder()
    .setContent(`**Opponent:** <@${ticket.opponentUserId}>`);
  opponentSection.addTextDisplayComponents(opponentText);
  opponentSection.setButtonAccessory(button =>
    button
      .setCustomId(`wager:decideWinner:${ticket._id}:opponent:depths`)
      .setStyle(ButtonStyle.Primary)
      .setLabel('Opponent Won')
  );
  container.addSectionComponents(opponentSection);
}

/**
 * Build control row for wager ticket
 * @param {string} ticketId
 * @returns {ActionRowBuilder}
 */
function buildWagerControlRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wager:claim:${ticketId}`)
      .setStyle(ButtonStyle.Success)
      .setLabel('Claim Ticket'),
    new ButtonBuilder()
      .setCustomId(`wager:closeTicket:${ticketId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Close + Transcript'),
    new ButtonBuilder()
      .setCustomId(`wager:markDodge:${ticketId}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Mark Dodge')
  );
}

module.exports = {
  buildParticipantsMention,
  getAllParticipantIds,
  buildWinnerDecisionPanel,
  buildWagerControlRow
};
