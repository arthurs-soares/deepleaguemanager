/**
 * War opponent modal handler - processes guild name input and shows confirmation
 */
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const Guild = require('../../models/guild/Guild');
const LoggerService = require('../../services/LoggerService');
const { safeDeferEphemeral } = require('../../utils/core/ack');

/** Max age (ms) before modal submission is skipped */
const MAX_AGE_MS = 2500;

/**
 * Handle war opponent modal submission
 * CustomId: war:opponentModal:<guildAId>:<region>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('warOpponentModal skipped (expired)', { age });
      return;
    }

    await safeDeferEphemeral(interaction);
    if (!interaction.deferred) return; // Defer failed, likely expired

    const parts = interaction.customId.split(':');
    const guildAId = parts[2];
    // Decode region (underscores back to spaces)
    const region = parts[3]?.replace(/_/g, ' ') || null;
    const opponentName = interaction.fields.getTextInputValue('opponentName')?.trim();

    if (!guildAId || !opponentName) {
      return interaction.editReply({
        content: '❌ Invalid data received.'
      });
    }

    // Find guildA
    const guildA = await Guild.findById(guildAId);
    if (!guildA) {
      return interaction.editReply({
        content: '❌ Your guild was not found.'
      });
    }

    // Search for opponent guild by name (case-insensitive)
    const opponents = await Guild.find({
      discordGuildId: interaction.guild.id,
      _id: { $ne: guildAId },
      name: { $regex: new RegExp(`^${escapeRegex(opponentName)}$`, 'i') }
    });

    if (opponents.length === 0) {
      // Try a partial match if exact match fails
      const partialMatches = await Guild.find({
        discordGuildId: interaction.guild.id,
        _id: { $ne: guildAId },
        name: { $regex: new RegExp(escapeRegex(opponentName), 'i') }
      }).limit(5);

      if (partialMatches.length === 0) {
        return interaction.editReply({
          content: `❌ No guild found with name **"${opponentName}"**.`
        });
      }

      if (partialMatches.length === 1) {
        // Use the single partial match
        return showConfirmation(interaction, guildA, partialMatches[0], region);
      }

      // Multiple partial matches - show suggestions
      const suggestions = partialMatches.map(g => `• ${g.name}`).join('\n');
      return interaction.editReply({
        content: `⚠️ Multiple guilds found matching **"${opponentName}"**:\n${suggestions}\n\nPlease type the exact guild name.`
      });
    }

    // Exact match found
    const guildB = opponents[0];
    return showConfirmation(interaction, guildA, guildB, region);
  } catch (error) {
    LoggerService.error('Error in warOpponentModal:', { error: error?.message });
    const msg = { content: '❌ Unable to process opponent selection.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(msg);
    }
    return interaction.reply(msg);
  }
}

/**
 * Show the war confirmation screen with Set Schedule button
 */
async function showConfirmation(interaction, guildA, guildB, region) {
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

  return interaction.editReply({
    components: [container, row],
    flags: MessageFlags.IsComponentsV2
  });
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { handle };
