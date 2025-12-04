const { MessageFlags } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { colors } = require('../../config/botConfig');
const EventPoints = require('../../models/rewards/EventPoints');
const { sendLog } = require('../core/logger');
const {
  upsertEventPointsLeaderboard
} = require('../leaderboard/eventPointsLeaderboard');
const LoggerService = require('../../services/LoggerService');

/**
 * Add event points to a user
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleAddPoints(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason';

    if (targetUser.bot) {
      return interaction.editReply({ content: '❌ Cannot add points to bots.' });
    }

    const updated = await EventPoints.findOneAndUpdate(
      { discordGuildId: interaction.guild.id, userId: targetUser.id },
      {
        $inc: { points: amount, totalEarned: amount },
        $setOnInsert: { discordGuildId: interaction.guild.id, userId: targetUser.id }
      },
      { upsert: true, new: true }
    );

    const container = buildResponseContainer('✅ Points Added',
      `Added **${amount.toLocaleString()}** points to ${targetUser}.\n` +
      `New balance: **${updated.points.toLocaleString()}** points.`);

    // Reply immediately, then update leaderboard in background
    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

    // Background tasks (non-blocking)
    sendLog(interaction.guild, '⭐ Event Points Added',
      `**Staff:** ${interaction.user} (${interaction.user.tag})\n` +
      `**User:** ${targetUser} (${targetUser.tag})\n` +
      `**Amount:** +${amount.toLocaleString()} points\n` +
      `**New Balance:** ${updated.points.toLocaleString()} points\n` +
      `**Reason:** ${reason}`).catch(() => {});

    upsertEventPointsLeaderboard(interaction.guild).catch(err => {
      LoggerService.error('Failed to update event leaderboard after add', {
        error: err?.message
      });
    });
  } catch (_) {
    return interaction.editReply({ content: '❌ Failed to add points.' });
  }
}

/**
 * Remove event points from a user
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function handleRemovePoints(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const targetUser = interaction.options.getUser('user');
    const amount = interaction.options.getInteger('amount');
    const reason = interaction.options.getString('reason') || 'No reason';

    if (targetUser.bot) {
      return interaction.editReply({ content: '❌ Cannot remove points from bots.' });
    }

    // Use findOneAndUpdate to allow negative points
    const updated = await EventPoints.findOneAndUpdate(
      { discordGuildId: interaction.guild.id, userId: targetUser.id },
      {
        $inc: { points: -amount },
        $setOnInsert: { discordGuildId: interaction.guild.id, userId: targetUser.id }
      },
      { upsert: true, new: true }
    );

    const container = buildResponseContainer('✅ Points Removed',
      `Removed **${amount.toLocaleString()}** points from ${targetUser}.\n` +
      `New balance: **${updated.points.toLocaleString()}** points.`);

    // Reply immediately, then update leaderboard in background
    await interaction.editReply({ components: [container], flags: MessageFlags.IsComponentsV2 });

    // Background tasks (non-blocking)
    sendLog(interaction.guild, '⭐ Event Points Removed',
      `**Staff:** ${interaction.user} (${interaction.user.tag})\n` +
      `**User:** ${targetUser} (${targetUser.tag})\n` +
      `**Amount:** -${amount.toLocaleString()} points\n` +
      `**New Balance:** ${updated.points.toLocaleString()} points\n` +
      `**Reason:** ${reason}`).catch(() => {});

    upsertEventPointsLeaderboard(interaction.guild).catch(err => {
      LoggerService.error('Failed to update event leaderboard after remove', {
        error: err?.message
      });
    });
  } catch (_) {
    return interaction.editReply({ content: '❌ Failed to remove points.' });
  }
}

/**
 * Build response container with Components v2
 * @param {string} title - Title text
 * @param {string} description - Description text
 * @returns {ContainerBuilder}
 */
function buildResponseContainer(title, description) {
  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16) : colors.primary;
  container.setAccentColor(primaryColor);

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${title}`));
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(description));

  return container;
}

module.exports = { handleAddPoints, handleRemovePoints };
