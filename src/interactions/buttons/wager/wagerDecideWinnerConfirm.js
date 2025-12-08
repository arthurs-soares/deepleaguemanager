const { PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder } = require('discord.js');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const WagerService = require('../../../services/WagerService');
const { buildWagerCloseButtonRow } = require('../../../utils/tickets/closeButtons');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');

/**
 * Confirm and execute wager winner decision
 * CustomId: wager:decideWinner:confirm:<ticketId>:<winnerKey>
 */
async function handle(interaction) {
  try {
    const components = interaction.message.components.map(row => {
      return ActionRowBuilder.from(row).setComponents(
        row.components.map(component =>
          ButtonBuilder.from(component).setDisabled(true)
        )
      );
    });

    await interaction.update({ components });

    const parts = interaction.customId.split(':');
    const [, , , ticketId, winnerKey] = parts;

    if (!ticketId || !winnerKey) {
      return interaction.followUp({
        content: '❌ Invalid parameters.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (!isDatabaseConnected()) {
      return interaction.followUp({
        content: '❌ Database is temporarily unavailable.',
        flags: MessageFlags.Ephemeral
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
      return interaction.followUp({
        content: '❌ Only hosters, moderators or admins can record.',
        flags: MessageFlags.Ephemeral
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
      return interaction.followUp({
        content: '❌ Ticket not found.',
        flags: MessageFlags.Ephemeral
      });
    }

    if (ticket.status !== 'open') {
      return interaction.followUp({
        content: '⚠️ This ticket is already closed or marked as dodge.',
        flags: MessageFlags.Ephemeral
      });
    }

    let embed;

    if (ticket.is2v2) {
      // 2v2 wager: determine winning and losing teams
      const winnerIds = winnerKey === 'initiator'
        ? [ticket.initiatorUserId, ticket.initiatorTeammateId]
        : [ticket.opponentUserId, ticket.opponentTeammateId];
      const loserIds = winnerKey === 'initiator'
        ? [ticket.opponentUserId, ticket.opponentTeammateId]
        : [ticket.initiatorUserId, ticket.initiatorTeammateId];

      embed = await WagerService.recordWager2v2(
        interaction.guild,
        interaction.user.id,
        winnerIds,
        loserIds,
        interaction.client
      );
    } else {
      // 1v1 wager
      const winnerId = winnerKey === 'initiator'
        ? ticket.initiatorUserId
        : ticket.opponentUserId;
      const loserId = winnerKey === 'initiator'
        ? ticket.opponentUserId
        : ticket.initiatorUserId;

      embed = await WagerService.recordWager(
        interaction.guild,
        interaction.user.id,
        winnerId,
        loserId,
        interaction.client
      );
    }

    // Close ticket
    ticket.status = 'closed';
    await ticket.save();

    // Remove confirmation message components
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) { }

    // Post to ticket channel
    const ch = interaction.guild.channels.cache.get(ticket.channelId);
    if (ch) {
      try {
        const resultMsg = ticket.is2v2
          ? `✅ Result recorded by <@${interaction.user.id}>. Points applied to all 4 players.`
          : `✅ Result recorded by <@${interaction.user.id}>. Points applied.`;

        // Add close button as a separate component (ActionRow)
        const closeButtonRow = buildWagerCloseButtonRow(ticket._id);

        await ch.send({
          content: resultMsg,
          components: [embed, closeButtonRow],
          flags: MessageFlags.IsComponentsV2
        });
      } catch (_) { }
    }

    const confirmMsg = ticket.is2v2
      ? '✅ Result applied. Points updated for all 4 players.'
      : '✅ Result applied. Points updated for both players.';
    return interaction.followUp({
      content: confirmMsg,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error confirming wager winner:', { error: error?.message });
    const msg = {
      content: '❌ Could not record the result.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
