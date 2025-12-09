const { PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const WagerService = require('../../../services/WagerService');
const { buildWagerCloseButtonRow } = require('../../../utils/tickets/closeButtons');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../../config/botConfig');

/**
 * Update the confirmation message to show success
 */
async function updateConfirmationUI(interaction) {
  try {
    const successColor = typeof colors.success === 'string'
      ? parseInt(colors.success.replace('#', ''), 16)
      : colors.success;

    const container = new ContainerBuilder()
      .setAccentColor(successColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.success} Result Confirmed`);

    const descText = new TextDisplayBuilder()
      .setContent(`Result confirmed by <@${interaction.user.id}>.`);

    container.addTextDisplayComponents(titleText, descText);

    await interaction.message.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (_) { /* Ignore update errors */ }
}

/**
 * Disable buttons on the current interaction
 */
async function disableButtons(interaction) {
  const components = interaction.message.components.map(row => {
    if (row.type === ComponentType.ActionRow) {
      return ActionRowBuilder.from(row).setComponents(
        row.components.map(component =>
          ButtonBuilder.from(component).setDisabled(true)
        )
      );
    }
    return row;
  });
  await interaction.update({ components });
}

/**
 * Execute the wager logic via service
 */
async function recordWagerResult(ticket, winnerKey, interaction) {
  if (ticket.is2v2) {
    const winnerIds = winnerKey === 'initiator'
      ? [ticket.initiatorUserId, ticket.initiatorTeammateId]
      : [ticket.opponentUserId, ticket.opponentTeammateId];
    const loserIds = winnerKey === 'initiator'
      ? [ticket.opponentUserId, ticket.opponentTeammateId]
      : [ticket.initiatorUserId, ticket.initiatorTeammateId];

    return await WagerService.recordWager2v2(
      interaction.guild,
      interaction.user.id,
      winnerIds,
      loserIds,
      interaction.client
    );
  }

  const winnerId = winnerKey === 'initiator'
    ? ticket.initiatorUserId
    : ticket.opponentUserId;
  const loserId = winnerKey === 'initiator'
    ? ticket.opponentUserId
    : ticket.initiatorUserId;

  return await WagerService.recordWager(
    interaction.guild,
    interaction.user.id,
    winnerId,
    loserId,
    interaction.client
  );
}

/**
 * Confirm and execute wager winner decision
 * CustomId: wager:decideWinner:confirm:<ticketId>:<winnerKey>
 */
async function handle(interaction) {
  try {
    await disableButtons(interaction);

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
    if (!isAdmin && !member.roles.cache.some(r => allowed.has(r.id))) {
      return interaction.followUp({
        content: '❌ Only hosters, moderators or admins can record.',
        flags: MessageFlags.Ephemeral
      });
    }

    let ticket = await WagerTicket.findById(ticketId).catch(() => null);
    if (!ticket) {
      // Fallback find by channel
      ticket = await WagerTicket.findOne({
        discordGuildId: interaction.guild.id,
        channelId: interaction.channel.id,
        status: 'open'
      });
    }

    if (!ticket) {
      return interaction.followUp({ content: '❌ Ticket not found.', flags: MessageFlags.Ephemeral });
    }

    if (ticket.status !== 'open') {
      return interaction.followUp({ content: '⚠️ This ticket is already closed.', flags: MessageFlags.Ephemeral });
    }

    const embed = await recordWagerResult(ticket, winnerKey, interaction);

    // Close ticket
    ticket.status = 'closed';
    await ticket.save();

    await updateConfirmationUI(interaction);

    // Post in channel
    const ch = interaction.guild.channels.cache.get(ticket.channelId);
    if (ch) {
      try {
        const resultMsg = ticket.is2v2
          ? `✅ Result recorded by <@${interaction.user.id}>. Points applied to all 4 players.`
          : `✅ Result recorded by <@${interaction.user.id}>. Points applied.`;

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
    return interaction.followUp({ content: confirmMsg, flags: MessageFlags.Ephemeral });

  } catch (error) {
    LoggerService.error('Error confirming wager winner:', { error: error?.message });
    const msg = { content: '❌ Could not record the result.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
