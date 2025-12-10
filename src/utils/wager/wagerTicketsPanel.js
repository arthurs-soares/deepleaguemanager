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
 * Build wager tickets panel (Components v2 with inline buttons)
 * @returns {ContainerBuilder}
 */
function buildWagerTicketsPanel() {
  const container = new ContainerBuilder();

  // Set accent color
  container.setAccentColor(colors.wager);

  // Banner image at the top
  const bannerGallery = new MediaGalleryBuilder()
    .addItems(
      new MediaGalleryItemBuilder()
        .setURL('https://cdn.discordapp.com/attachments/1353102690040807556/1446146291057819668/image.png?ex=6932ec2f&is=69319aaf&hm=270fc04872b1035a696f9473eeb2186a3c4fcd46835b18e506331b032886b27f&')
        .setDescription('Wager Tickets Banner')
    );

  container.addMediaGalleryComponents(bannerGallery);

  // Header
  const titleText = new TextDisplayBuilder()
    .setContent(`# Wager Tickets`);

  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Use this panel to initiate a wager challenge.\n\n` +
      '• **1v1 Wager** - Challenge a single opponent\n' +
      '• **2v2 Wager** - Team up with a friend and challenge two opponents\n\n' +
      'The bot will create a private channel in the configured category.'
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Start 1v1 Wager section with inline button
  const startWagerSection = new SectionBuilder();
  const startWagerText = new TextDisplayBuilder()
    .setContent(
      `**${emojis.depthsWager} 1v1 Wager**\n` +
      'Create a solo wager'
    );
  startWagerSection.addTextDisplayComponents(startWagerText);
  startWagerSection.setButtonAccessory(button =>
    button
      .setCustomId('wager:start')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Start 1v1')
  );

  container.addSectionComponents(startWagerSection);

  // Start 2v2 Wager section with inline button
  const start2v2Section = new SectionBuilder();
  const start2v2Text = new TextDisplayBuilder()
    .setContent(
      `**${emojis.depthsWager} 2v2 Wager**\n` +
      'Team up with a friend'
    );
  start2v2Section.addTextDisplayComponents(start2v2Text);
  start2v2Section.setButtonAccessory(button =>
    button
      .setCustomId('wager:start2v2')
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Start 2v2')
  );

  container.addSectionComponents(start2v2Section);
  container.addSeparatorComponents(new SeparatorBuilder());

  const footerText = new TextDisplayBuilder()
    .setContent('Wager System');
  container.addTextDisplayComponents(footerText);

  return container;
}

/**
 * Send the panel to the specified channel
 * @param {import('discord.js').TextChannel | import('discord.js').NewsChannel} channel
 */
async function sendWagerTicketsPanel(channel) {
  const container = buildWagerTicketsPanel();

  return channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

module.exports = { buildWagerTicketsPanel, sendWagerTicketsPanel };

