const { AttachmentBuilder } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder
} = require('@discordjs/builders');
const { colors } = require('../../config/botConfig');

const { createDodgeImage } = require('./canvas/wagerDodgeCanvas');

/**
 * Build Wager Dodge container using Components v2 and image attachment.
 * Returns a fallback container if image creation fails.
 * @param {import('discord.js').User} dodgerUser
 * @param {import('discord.js').User} opponentUser
 * @param {string} [markedByUserId]
 * @param {Date} [when]
 * @returns {Promise<{ container: ContainerBuilder, attachment: import('discord.js').AttachmentBuilder | null }>}
 */
async function buildWagerDodgeEmbed(dodgerUser, opponentUser, markedByUserId, when = new Date()) {
  const container = new ContainerBuilder();

  // Set accent color for warning
  const warningColor = typeof colors.warning === 'string'
    ? parseInt(colors.warning.replace('#', ''), 16)
    : colors.warning;
  container.setAccentColor(warningColor);

  try {
    const buffer = await createDodgeImage(dodgerUser, opponentUser);
    const attachment = new AttachmentBuilder(buffer, { name: 'wager-dodge.png' });

    // Header
    const titleText = new TextDisplayBuilder()
      .setContent('# 🚫 Wager Dodge');
    const descText = new TextDisplayBuilder()
      .setContent(`${dodgerUser} dodged a wager vs ${opponentUser}`);

    container.addTextDisplayComponents(titleText, descText);
    container.addSeparatorComponents(new SeparatorBuilder());

    // Image gallery using attachment protocol
    const imageGallery = new MediaGalleryBuilder()
      .addItems(
        new MediaGalleryItemBuilder()
          .setURL('attachment://wager-dodge.png')
          .setDescription('Wager Dodge Notification')
      );
    container.addMediaGalleryComponents(imageGallery);

    // Marked by if provided
    if (markedByUserId) {
      const markedByText = new TextDisplayBuilder()
        .setContent(`**Marked by:** <@${markedByUserId}>`);
      container.addTextDisplayComponents(markedByText);
    }

    // Timestamp footer
    const timestamp = Math.floor(when.getTime() / 1000);
    const timestampText = new TextDisplayBuilder()
      .setContent(`*<t:${timestamp}:F>*`);
    container.addTextDisplayComponents(timestampText);

    return { container, attachment };
  } catch (error) {
    console.error('Failed to create wager dodge image:', error);

    // Fallback: simple container without image
    const titleText = new TextDisplayBuilder()
      .setContent('# 🚫 Wager Dodge');
    container.addTextDisplayComponents(titleText);
    container.addSeparatorComponents(new SeparatorBuilder());

    const dodgerText = new TextDisplayBuilder()
      .setContent(`**Dodger**\n${dodgerUser ? `<@${dodgerUser.id}>` : 'Unknown'}`);
    const opponentText = new TextDisplayBuilder()
      .setContent(`**Opponent**\n${opponentUser ? `<@${opponentUser.id}>` : 'Unknown'}`);

    container.addTextDisplayComponents(dodgerText, opponentText);

    if (markedByUserId) {
      const markedByText = new TextDisplayBuilder()
        .setContent(`**Marked by**\n<@${markedByUserId}>`);
      container.addTextDisplayComponents(markedByText);
    }

    // Timestamp footer
    const timestamp = Math.floor(when.getTime() / 1000);
    const timestampText = new TextDisplayBuilder()
      .setContent(`*<t:${timestamp}:F>*`);
    container.addTextDisplayComponents(timestampText);

    return { container, attachment: null };
  }
}

module.exports = { buildWagerDodgeEmbed };

