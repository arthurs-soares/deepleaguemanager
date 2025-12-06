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
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');
const { colors, emojis } = require('../../../config/botConfig');

/**
 * Show confirmation dialog before deciding wager winner
 * CustomId: wager:decideWinner:<ticketId>:<winnerKey>[:<type>]
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const [, , ticketId, winnerKey] = parts;

    if (!ticketId || !winnerKey) {
      return interaction.editReply({ content: '❌ Invalid parameters.' });
    }

    if (!isDatabaseConnected()) {
      return interaction.editReply({
        content: '❌ Database is temporarily unavailable.'
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const cfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowed = new Set([
      ...(cfg?.hostersRoleIds || []),
      ...(cfg?.moderatorsRoleIds || [])
    ]);
    const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);
    const hasRole = member.roles.cache.some(r => allowed.has(r.id));
    if (!isAdmin && !hasRole) {
      return interaction.editReply({
        content: '❌ Only hosters, moderators or admins can record.'
      });
    }

    let ticket = await WagerTicket.findById(ticketId).catch(() => null);

    if (!ticket) {
      ticket = await WagerTicket.findOne({
        discordGuildId: interaction.guild.id,
        channelId: interaction.channel.id,
        status: 'open'
      });
    }

    if (!ticket) {
      return interaction.editReply({ content: '❌ Ticket not found.' });
    }

    if (ticket.status !== 'open') {
      return interaction.editReply({
        content: '⚠️ This ticket is already closed or marked as dodge.'
      });
    }

    const winnerId = winnerKey === 'initiator'
      ? ticket.initiatorUserId
      : ticket.opponentUserId;
    const loserId = winnerKey === 'initiator'
      ? ticket.opponentUserId
      : ticket.initiatorUserId;

    // Build confirmation container
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning} Confirm Wager Result`);

    const descText = new TextDisplayBuilder()
      .setContent(
        'Are you sure you want to record this result?\n' +
        'This action **cannot be undone** and will update ELO.'
      );

    const detailsText = new TextDisplayBuilder()
      .setContent(
        `**Winner:** <@${winnerId}>\n` +
        `**Loser:** <@${loserId}>`
      );

    container.addTextDisplayComponents(titleText, descText, detailsText);

    // Create confirmation buttons
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wager:decideWinner:confirm:${ticketId}:${winnerKey}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Winner'),
      new ButtonBuilder()
        .setCustomId(`wager:decideWinner:cancel:${ticketId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    // Do not include a 'content' field when using Components v2 - the API rejects it.
    await interaction.editReply({
      components: [container, actionRow],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in wager:decideWinner:', error);
    const msg = {
      content: '❌ Could not show confirmation.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

