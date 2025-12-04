const { ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');

/**
 * Build general tickets panel (Components v2 with inline buttons)
 * @returns {ContainerBuilder}
 */
function buildGeneralTicketsPanel() {
  const container = new ContainerBuilder();

  // Set accent color
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.ticket} General Tickets`);

  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Select a ticket category below to open a support ticket.\n\n` +
      'The bot will create a private channel where you can discuss your issue with the support team.'
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Ticket Categories with inline buttons
  const adminSection = new SectionBuilder();
  const adminText = new TextDisplayBuilder()
    .setContent(
      '**⚠️ Admin Ticket**\n' +
      'Reports for chasebannable rules'
    );
  adminSection.addTextDisplayComponents(adminText);
  adminSection.setButtonAccessory(button =>
    button
      .setCustomId('ticket:open:admin')
      .setStyle(ButtonStyle.Danger)
      .setLabel('Admin ticket')
  );

  const blacklistSection = new SectionBuilder();
  const blacklistText = new TextDisplayBuilder()
    .setContent(
      '**📝 Blacklist Appeal**\n' +
      'Ask for a blacklist appeal'
    );
  blacklistSection.addTextDisplayComponents(blacklistText);
  blacklistSection.setButtonAccessory(button =>
    button
      .setCustomId('ticket:open:blacklist_appeal')
      .setStyle(ButtonStyle.Primary)
      .setLabel('BL Appeal')
  );

  const generalSection = new SectionBuilder();
  const generalText = new TextDisplayBuilder()
    .setContent(
      '**💬 General**\n' +
      'General stuff regarding the server'
    );
  generalSection.addTextDisplayComponents(generalText);
  generalSection.setButtonAccessory(button =>
    button
      .setCustomId('ticket:open:general')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('General Ticket')
  );

  const rosterSection = new SectionBuilder();
  const rosterText = new TextDisplayBuilder()
    .setContent(
      '**📋 Roster**\n' +
      'Roster register/edit'
    );
  rosterSection.addTextDisplayComponents(rosterText);
  rosterSection.setButtonAccessory(button =>
    button
      .setCustomId('ticket:open:roster')
      .setStyle(ButtonStyle.Success)
      .setLabel('Roster Ticket')
  );

  container.addSectionComponents(adminSection, blacklistSection, generalSection, rosterSection);
  container.addSeparatorComponents(new SeparatorBuilder());

  const footerText = new TextDisplayBuilder()
    .setContent(`*${emojis.ticket} Support Ticket System*`);
  container.addTextDisplayComponents(footerText);

  return container;
}

/**
 * Send the panel to the specified channel
 * @param {import('discord.js').TextChannel | import('discord.js').NewsChannel} channel
 */
async function sendGeneralTicketsPanel(channel) {
  try {
    const container = buildGeneralTicketsPanel();

    return await channel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    console.error('Error sending general tickets panel:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    throw error;
  }
}

module.exports = { buildGeneralTicketsPanel, sendGeneralTicketsPanel };

