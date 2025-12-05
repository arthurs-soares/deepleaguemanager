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
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const { isDatabaseConnected } = require('../../../config/database');
const { colors, emojis } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');
const { unlockChannelForUsers } = require('../../../utils/wager/wagerChannelManager');
const {
  buildParticipantsMention,
  getAllParticipantIds,
  buildWinnerDecisionPanel,
  buildWagerControlRow
} = require('../../../utils/wager/wagerAcceptUtils');

/**
 * Accept the wager and post the pinned control panel
 * CustomId: wager:accept:<ticketId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , ticketId] = interaction.customId.split(':');
    if (!ticketId) return interaction.editReply({ content: '❌ Ticket ID not provided.' });

    // Check database connection
    if (!isDatabaseConnected()) {
      return interaction.editReply({ content: '❌ Database is temporarily unavailable.' });
    }

    // Try to find by ID first, then by channel as fallback
    let ticket = await WagerTicket.findById(ticketId).catch(() => null);

    // Fallback: find by channel ID if the ticket ID lookup fails
    if (!ticket) {
      LoggerService.warn('Ticket not found by ID, trying channel fallback', {
        ticketId,
        channelId: interaction.channel?.id
      });
      ticket = await WagerTicket.findOne({
        discordGuildId: interaction.guild.id,
        channelId: interaction.channel.id,
        status: 'open'
      });
    }

    if (!ticket) {
      LoggerService.warn('Ticket not found', { ticketId, channelId: interaction.channel?.id });
      return interaction.editReply({ content: '❌ Ticket not found.' });
    }
    if (ticket.status !== 'open') return interaction.editReply({ content: '⚠️ This ticket is not open.' });

    // Check if ticket has already been accepted (prevent spam pings)
    if (ticket.acceptedAt) {
      return interaction.editReply({
        content: `⚠️ This ticket has already been accepted by <@${ticket.acceptedByUserId}> at <t:${Math.floor(ticket.acceptedAt.getTime() / 1000)}:R>.`
      });
    }

    // Only participants or team members (hosters/moderators/admin) can accept
    const cfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedTeam = new Set([...(cfg?.hostersRoleIds || []), ...(cfg?.moderatorsRoleIds || [])]);
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);
    const isTeam = isAdmin || member.roles.cache.some(r => allowedTeam.has(r.id));
    const isInitiator = ticket.initiatorUserId === interaction.user.id;
    const isInitiatorTeammate = ticket.is2v2 && ticket.initiatorTeammateId === interaction.user.id;
    const isOpponent = ticket.opponentUserId === interaction.user.id ||
      (ticket.is2v2 && ticket.opponentTeammateId === interaction.user.id);

    // Initiator team cannot accept their own wager (only opponent or team can)
    if ((isInitiator || isInitiatorTeammate) && !isTeam) {
      return interaction.editReply({
        content: '❌ You cannot accept your own wager. Only the challenged team can accept.'
      });
    }

    if (!isTeam && !isOpponent) {
      return interaction.editReply({
        content: '❌ Only challenged team, hosters, moderators or admins can accept.'
      });
    }

    const channel = interaction.guild.channels.cache.get(ticket.channelId);
    if (!channel) return interaction.editReply({ content: '❌ Ticket channel not found.' });

    // Mark ticket as accepted (atomic update to prevent race conditions)
    ticket.acceptedAt = new Date();
    ticket.acceptedByUserId = interaction.user.id;
    await ticket.save();

    // Unlock chat for all participants
    const participantIds = getAllParticipantIds(ticket);
    await unlockChannelForUsers(channel, participantIds);

    // Disable the Accept button - rebuild with Components v2 showing accepted state
    try {
      const acceptedContainer = new ContainerBuilder()
        .setAccentColor(colors.success)
        .addTextDisplayComponents(
          new TextDisplayBuilder()
            .setContent(`# ${emojis.depthsWager} Wager Ticket\n✅ **Accepted** by <@${interaction.user.id}>`)
        );

      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`wager:closeTicket:${ticket._id}`)
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Close Ticket'),
        new ButtonBuilder()
          .setCustomId(`wager:markDodge:${ticket._id}`)
          .setStyle(ButtonStyle.Danger)
          .setLabel('Mark Dodge')
      );

      await interaction.message.edit({
        components: [acceptedContainer, disabledRow],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (err) {
      LoggerService.warn('Failed to update accept message:', { error: err?.message });
    }

    // Check if hoster pings are enabled for this server
    const serverSettings = await getOrCreateServerSettings(interaction.guild.id);
    const hosterPingEnabled = serverSettings.hosterPingEnabled !== false;

    // Mention hosters (roles) to evaluate and decide - ONLY on acceptance, not creation
    const hosterRoleIds = cfg?.hostersRoleIds || [];
    const hostersMention = hosterPingEnabled && hosterRoleIds.length
      ? hosterRoleIds.map(id => `<@&${id}>`).join(' ')
      : null;
    const participantsMention = buildParticipantsMention(ticket);

    if (hostersMention) {
      try {
        await channel.send({
          content: `📣 ${hostersMention} — wager accepted by <@${interaction.user.id}>. Participants: ${participantsMention}`,
          allowedMentions: { parse: ['roles', 'users'] }
        });
      } catch (_) {}
    } else {
      try {
        await channel.send({
          content: `📣 Wager accepted by <@${interaction.user.id}>. Participants: ${participantsMention}`,
          allowedMentions: { parse: ['users'] }
        });
      } catch (_) {}
    }

    // Pinned decision/control panel
    const container = buildWinnerDecisionPanel(ticket);
    const controlRow = buildWagerControlRow(ticket._id);

    await sendAndPin(
      channel,
      { components: [container, controlRow], flags: MessageFlags.IsComponentsV2 },
      { unpinOld: true }
    );

    return interaction.editReply({ content: '✅ Pinned panel sent.' });
  } catch (error) {
    LoggerService.error('Error in wager:accept:', error);
    const msg = { content: '❌ Could not accept wager.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle, getAllParticipantIds, buildParticipantsMention };

