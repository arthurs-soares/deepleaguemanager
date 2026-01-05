const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const Guild = require('../../models/guild/Guild');
const LoggerService = require('../../services/LoggerService');

/** Max age (ms) before selection is skipped */
const MAX_AGE_MS = 2500;

/**
 * Opponent selection dropdown
 * CustomId: war:selectOpponent:<guildAId>:<region>:<idx>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('war:selectOpponent skipped (expired)', { age });
      return;
    }

    const parts = interaction.customId.split(':');
    const guildAId = parts[2];
    // Decode region (underscores back to spaces)
    const region = parts[3]?.replace(/_/g, ' ');
    const guildBId = interaction.values?.[0];
    if (!guildAId || !guildBId) return interaction.deferUpdate();

    const [guildA, guildB] = await Promise.all([
      Guild.findById(guildAId),
      Guild.findById(guildBId),
    ]);
    if (!guildA || !guildB) return interaction.deferUpdate();

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.war} War Creation Flow`);

    const descText = new TextDisplayBuilder()
      .setContent(`War: ${guildA.name} VS ${guildB.name}\nRegion: ${region}`);

    const footerText = new TextDisplayBuilder()
      .setContent('*📅 Click "Set Schedule" to enter date and time*');

    container.addTextDisplayComponents(titleText, descText, footerText);

    // Encode region for safe customId (replace spaces with underscores)
    const safeRegion = region.replace(/ /g, '_');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`war:openScheduleModal:${guildA._id}:${guildB._id}:${safeRegion}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Set Schedule')
        .setEmoji('📅')
    );

    // Update the ephemeral message
    return interaction.update({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in war:selectOpponent select:', error);
    const msg = { content: '❌ Error selecting opponent.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

