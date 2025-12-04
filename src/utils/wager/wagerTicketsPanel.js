const { MessageFlags, ButtonStyle } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SectionBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('@discordjs/builders');
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
    .setContent(`# ${emojis.depthsWager} Wager Tickets`);

  const descText = new TextDisplayBuilder()
    .setContent(
      `${emojis.info} Use this panel to initiate a wager challenge between players.\n\n` +
      '• Click the button below to start\n' +
      '• Choose opponent and basic details\n\n' +
      'The bot will create a private channel in the configured category to coordinate the wager.'
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Start Wager section with inline button
  const startWagerSection = new SectionBuilder();
  const startWagerText = new TextDisplayBuilder()
    .setContent(
      `**${emojis.depthsWager} Start Wager**\n` +
      'Create a new wager between players'
    );
  startWagerSection.addTextDisplayComponents(startWagerText);
  startWagerSection.setButtonAccessory(button =>
    button
      .setCustomId('wager:start')
      .setStyle(ButtonStyle.Primary)
      .setLabel('Start Wager')
  );

  container.addSectionComponents(startWagerSection);
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

