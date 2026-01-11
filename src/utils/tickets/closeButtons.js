const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Build an action row with a Close Ticket button for Wager tickets
 * @param {string} ticketId
 * @returns {import('discord.js').ActionRowBuilder}
 */
function buildWagerCloseButtonRow(ticketId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`wager:closeTicket:${ticketId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Close + Transcript')
  );
}

/**
 * Build an action row with a Close Ticket button for War tickets
 * @param {string} warId
 * @returns {import('discord.js').ActionRowBuilder}
 */
function buildWarCloseButtonRow(warId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`war:closeTicket:${warId}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Close + Transcript')
  );
}

/**
 * Build an action row with Close Thread button for Support DM fallback threads
 * @returns {import('discord.js').ActionRowBuilder}
 */
function buildSupportCloseButtonRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('support:closeThread')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Close + Transcript')
  );
}

module.exports = { buildWagerCloseButtonRow, buildWarCloseButtonRow, buildSupportCloseButtonRow };

