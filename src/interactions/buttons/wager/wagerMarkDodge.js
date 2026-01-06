const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits
} = require('discord.js');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');
const { safeDeferEphemeral } = require('../../../utils/core/ack');

/** Max age (ms) before button click is skipped */
const MAX_AGE_MS = 2500;

/**
 * Start dodge flow for a wager
 * - Hosters/Mods can select any participant as dodger
 * - Challenged user (opponent) can mark themselves as dodge
 * CustomId: wager:markDodge:<ticketId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('wager:markDodge skipped (expired)', { age });
      return;
    }

    await safeDeferEphemeral(interaction);
    if (!interaction.deferred) return; // Defer failed, likely expired

    const [, , ticketId] = interaction.customId.split(':');
    if (!ticketId) {
      return interaction.editReply({ content: '❌ Ticket ID not provided.' });
    }

    if (!isDatabaseConnected()) {
      return interaction.editReply({ content: '❌ Database unavailable.' });
    }

    let ticket = await WagerTicket.findById(ticketId).catch(() => null);
    if (!ticket) {
      ticket = await WagerTicket.findOne({
        discordGuildId: interaction.guild.id,
        channelId: interaction.channel.id
      }).sort({ createdAt: -1 });
    }

    if (!ticket) {
      return interaction.editReply({ content: '❌ Ticket not found.' });
    }

    if (ticket.status !== 'open') {
      return interaction.editReply({
        content: `⚠️ Ticket is not open (status: ${ticket.status}).`
      });
    }

    // Check permissions
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([
      ...(rolesCfg?.hostersRoleIds || []),
      ...(rolesCfg?.moderatorsRoleIds || [])
    ]);
    const member = interaction.member;
    const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);
    const isStaff = isAdmin || member.roles.cache.some(r => allowedRoleIds.has(r.id));

    // Check if user is a participant (initiator or opponent)
    const isInitiator = ticket.initiatorUserId === interaction.user.id ||
      (ticket.is2v2 && ticket.initiatorTeammateId === interaction.user.id);
    const isOpponent = ticket.opponentUserId === interaction.user.id ||
      (ticket.is2v2 && ticket.opponentTeammateId === interaction.user.id);
    const isParticipant = isInitiator || isOpponent;

    // Only staff or participants can use this button
    if (!isStaff && !isParticipant) {
      return interaction.editReply({
        content: '❌ Only hosters, moderators, or wager participants can mark dodge.'
      });
    }

    // If participant clicks, auto-dodge themselves (no selector needed)
    if (isParticipant && !isStaff) {
      return handleSelfDodge(interaction, ticket);
    }

    // Staff: show selector to choose who dodged
    return showDodgeSelector(interaction, ticket);
  } catch (error) {
    LoggerService.error('Error in wager:markDodge:', error);
    const msg = { content: '❌ Could not process dodge request.' };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ ...msg, flags: MessageFlags.Ephemeral });
    }
    return interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle self-dodge by opponent
 */
async function handleSelfDodge(interaction, ticket) {
  const sourceMessageId = interaction.message?.id || '0';

  // Go directly to confirm flow with the user's own ID
  return interaction.editReply({
    content: '⚠️ You are about to mark **yourself** as dodging this wager.\n' +
      'This will record a dodge loss on your profile.\n\n' +
      'Click below to confirm.',
    components: [
      new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`wager:dodge:select:${ticket._id}:${sourceMessageId}`)
          .setPlaceholder('Confirm self-dodge')
          .addOptions([
            {
              label: 'I dodged this wager',
              value: interaction.user.id,
              description: 'Mark yourself as dodger'
            }
          ])
      )
    ]
  });
}

/**
 * Show dodge selector for staff
 */
async function showDodgeSelector(interaction, ticket) {
  const sourceMessageId = interaction.message?.id || '0';

  const options = [];

  // Add initiator
  const initiator = await interaction.client.users
    .fetch(ticket.initiatorUserId).catch(() => null);
  options.push({
    label: `Initiator: ${initiator?.tag || ticket.initiatorUserId}`,
    value: ticket.initiatorUserId
  });

  // Add initiator teammate for 2v2
  if (ticket.is2v2 && ticket.initiatorTeammateId) {
    const teammate = await interaction.client.users
      .fetch(ticket.initiatorTeammateId).catch(() => null);
    options.push({
      label: `Initiator Teammate: ${teammate?.tag || ticket.initiatorTeammateId}`,
      value: ticket.initiatorTeammateId
    });
  }

  // Add opponent
  const opponent = await interaction.client.users
    .fetch(ticket.opponentUserId).catch(() => null);
  options.push({
    label: `Opponent: ${opponent?.tag || ticket.opponentUserId}`,
    value: ticket.opponentUserId
  });

  // Add opponent teammate for 2v2
  if (ticket.is2v2 && ticket.opponentTeammateId) {
    const oppTeammate = await interaction.client.users
      .fetch(ticket.opponentTeammateId).catch(() => null);
    options.push({
      label: `Opponent Teammate: ${oppTeammate?.tag || ticket.opponentTeammateId}`,
      value: ticket.opponentTeammateId
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`wager:dodge:select:${ticket._id}:${sourceMessageId}`)
    .setPlaceholder('Select which user dodged')
    .addOptions(options);

  return interaction.editReply({
    content: 'Select which participant dodged this wager.',
    components: [new ActionRowBuilder().addComponents(menu)]
  });
}

module.exports = { handle };

