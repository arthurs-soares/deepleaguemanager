const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const Guild = require('../../models/guild/Guild');
const { chunkArray } = require('../../utils/misc/array');
const LoggerService = require('../../services/LoggerService');

/** Max age (ms) before selection is skipped */
const MAX_AGE_MS = 2500;

/**
 * Region selection for war creation
 * CustomId: war:selectRegion:<guildAId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('war:selectRegion skipped (expired)', { age });
      return;
    }

    const [, , guildAId] = interaction.customId.split(':');
    const selectedRegion = interaction.values?.[0];
    if (!guildAId || !selectedRegion) return interaction.deferUpdate();

    const guildA = await Guild.findById(guildAId).select('name');
    if (!guildA) {
      return interaction.update({
        content: '❌ Your guild was not found.',
        components: []
      });
    }

    // Cross-region wars: show all active guilds, not just same region
    const opponents = await Guild.find({
      discordGuildId: interaction.guild.id,
      _id: { $ne: guildAId },
      'regions.status': 'active'
    }).select('name regions');

    if (!opponents.length) {
      return interaction.update({
        content: '⚠️ No active guilds found to challenge.',
        components: []
      });
    }

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.war} War Creation Flow`);

    const descText = new TextDisplayBuilder()
      .setContent(
        `**Your Guild:** ${guildA.name}\n` +
        `**Region:** ${selectedRegion}`
      );

    container.addTextDisplayComponents(titleText, descText);

    if (opponents.length > 125) {
      const infoText = new TextDisplayBuilder()
        .setContent(
          '**ℹ️ Info**\n' +
          'Opponent list was truncated to 125 items.'
        );
      container.addTextDisplayComponents(infoText);
    }

    container.addSeparatorComponents(new SeparatorBuilder());

    const footerText = new TextDisplayBuilder()
      .setContent('*Select the opponent guild from the menu below*');
    container.addTextDisplayComponents(footerText);

    const optionChunks = chunkArray(opponents, 25).slice(0, 5);

    // Encode region for safe customId (replace spaces with underscores)
    const safeRegion = selectedRegion.replace(/ /g, '_');

    const rows = optionChunks.map((chunk, idx) => {
      const placeholder = idx === 0
        ? 'Select opponent guild'
        : `More options (${idx + 1}/${optionChunks.length})`;

      const select = new StringSelectMenuBuilder()
        .setCustomId(`war:selectOpponent:${guildAId}:${safeRegion}:${idx}`)
        .setPlaceholder(placeholder)
        .addOptions(chunk.map(g => ({
          label: g.name,
          value: String(g._id)
        })));

      return new ActionRowBuilder().addComponents(select);
    });

    return interaction.update({ components: [container, ...rows] });
  } catch (error) {
    LoggerService.error('Error in war:selectRegion select:', error);
    return interaction.update({
      content: '❌ Error selecting region.',
      components: []
    });
  }
}

module.exports = { handle };
