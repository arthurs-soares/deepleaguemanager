const { MessageFlags, ButtonStyle } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder
} = require('@discordjs/builders');
const { emojis, colors } = require('../../config/botConfig');

/**
 * Build war tickets panel (Components v2 with inline buttons)
 * @returns {ContainerBuilder}
 */
function buildWarTicketsPanel() {
  const container = new ContainerBuilder();

  // Set accent color
  container.setAccentColor(colors.war);

  // Banner image at the top
  const bannerGallery = new MediaGalleryBuilder()
    .addItems(
      new MediaGalleryItemBuilder()
        .setURL('https://media.discordapp.net/attachments/1353102690040807556/1446158712531058772/821PqUe.png?ex=6932f7c1&is=6931a641&hm=c2bbd2f7d7dde8f4571e33f8c05f1c11cd7b00151b60b3ec1bf64311fcba581c&=&format=webp&quality=lossless&width=1843&height=461')
        .setDescription('War Tickets Banner')
    );

  container.addMediaGalleryComponents(bannerGallery);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent(`# ${emojis.warTicket} War Tickets`);

  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Use this panel to start the flow of creating a ` +
      'war between guilds.\n\n' +
      '• Click the button below to start\n' +
      '• Select the opponent guild\n' +
      '• Enter war date and time\n\n' +
      'The bot will create a private channel in the ' +
      'configured category to organize the details.'
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Start War section with inline button
  const startWarSection = new SectionBuilder();
  const startWarText = new TextDisplayBuilder()
    .setContent(
      `**${emojis.warTicket} Start War**\n` +
      'Create a new war between guilds'
    );
  startWarSection.addTextDisplayComponents(startWarText);
  startWarSection.setButtonAccessory(button =>
    button
      .setCustomId('war:start')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Start War')
  );

  container.addSectionComponents(startWarSection);
  container.addSeparatorComponents(new SeparatorBuilder());

  const footerText = new TextDisplayBuilder()
    .setContent('War System');
  container.addTextDisplayComponents(footerText);

  return container;
}

/**
 * Send the panel to the specified channel
 * @param {import('discord.js').TextChannel|import('discord.js').NewsChannel} ch
 */
async function sendWarTicketsPanel(ch) {
  const container = buildWarTicketsPanel();

  return ch.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

module.exports = { buildWarTicketsPanel, sendWarTicketsPanel };

