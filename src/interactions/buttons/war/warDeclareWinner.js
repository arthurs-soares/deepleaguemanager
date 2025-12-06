const {
  PermissionFlagsBits,
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const { replyEphemeral } = require('../../../utils/core/reply');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { colors, emojis } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');

/**
 * Show confirmation dialog before declaring war winner
 * CustomId: war:declareWinner:<warId>:<winnerGuildId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply();

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([
      ...(rolesCfg?.hostersRoleIds || []),
      ...(rolesCfg?.moderatorsRoleIds || [])
    ]);

    const hasAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    const hasRole = member.roles.cache.some(r => allowedRoleIds.has(r.id));

    if (!hasAdmin && !hasRole) {
      return interaction.editReply({
        content: '❌ Only hosters, moderators or admins can declare.'
      });
    }

    const [, , warId, winnerGuildId] = interaction.customId.split(':');
    const war = await War.findById(warId);
    if (!war || war.status !== 'aberta') {
      return interaction.editReply({
        content: '⚠️ Invalid war or already finished.'
      });
    }

    const [guildA, guildB, winner] = await Promise.all([
      Guild.findById(war.guildAId),
      Guild.findById(war.guildBId),
      Guild.findById(winnerGuildId),
    ]);

    if (!winner) {
      return interaction.editReply({ content: '❌ Invalid winner guild.' });
    }

    const loserName = String(winner._id) === String(guildA._id)
      ? (guildB?.name || 'Unknown')
      : (guildA?.name || 'Unknown');

    // Build confirmation container
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning} Confirm Winner Declaration`);

    const descText = new TextDisplayBuilder()
      .setContent(
        'Are you sure you want to declare the winner?\n' +
        'This action **cannot be undone** and will update guild stats.'
      );

    const detailsText = new TextDisplayBuilder()
      .setContent(
        `**War:** ${guildA?.name} vs ${guildB?.name}\n` +
        `**Winner:** ${winner.name}\n` +
        `**Loser:** ${loserName}`
      );

    container.addTextDisplayComponents(titleText, descText, detailsText);

    // Create confirmation buttons
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`war:declareWinner:confirm:${warId}:${winnerGuildId}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Winner'),
      new ButtonBuilder()
        .setCustomId(`war:declareWinner:cancel:${warId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    await interaction.editReply({
      content: '',
      components: [container, actionRow],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error showing winner confirmation:', error);
    return replyEphemeral(interaction, {
      content: '❌ Could not show confirmation.'
    });
  }
}

module.exports = { handle };

