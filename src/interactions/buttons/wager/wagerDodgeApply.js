const { ChannelType, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { buildWagerDodgeEmbed } = require('../../../utils/embeds/wagerDodgeEmbed');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { sendTranscriptToLogs } = require('../../../utils/tickets/transcript');
const { sendWagerDodgeLog } = require('../../../utils/tickets/wagerDodgeLog');
const { buildWagerCloseButtonRow } = require('../../../utils/tickets/closeButtons');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');
const { unlockChannelForUsers } = require('../../../utils/wager/wagerChannelManager');

/**
 * Apply wager dodge after confirmation
 * CustomId: wager:dodge:apply:<ticketId>:<dodgerUserId>:<sourceMessageId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const ticketId = parts[3];
    const dodgerUserId = parts[4];
    const sourceMessageId = parts[5] && parts[5] !== '0' ? parts[5] : null;

    if (!ticketId || !dodgerUserId) {
      return interaction.editReply({ content: '❌ Invalid parameters.' });
    }

    if (!isDatabaseConnected()) {
      return interaction.editReply({ content: '❌ Database unavailable.' });
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

    // Allow self-dodge: user can mark themselves as dodger
    const isSelfDodge = interaction.user.id === dodgerUserId;

    if (!isStaff && !isSelfDodge) {
      return interaction.editReply({
        content: '❌ Only staff can mark others as dodge.'
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
      return interaction.editReply({ content: '⚠️ Ticket not open.' });
    }

    // If self-dodge, verify user is a participant (initiator or opponent)
    if (isSelfDodge && !isStaff) {
      const isInitiator = ticket.initiatorUserId === interaction.user.id ||
        (ticket.is2v2 && ticket.initiatorTeammateId === interaction.user.id);
      const isOpponent = ticket.opponentUserId === interaction.user.id ||
        (ticket.is2v2 && ticket.opponentTeammateId === interaction.user.id);
      if (!isInitiator && !isOpponent) {
        return interaction.editReply({
          content: '❌ Only wager participants can self-dodge.'
        });
      }
    }

    ticket.status = 'dodge';
    ticket.dodgedByUserId = dodgerUserId;
    await ticket.save();

    // Unlock chat after dodge (so users can communicate if needed)
    const ch = interaction.guild.channels.cache.get(ticket.channelId);
    if (ch) {
      const participantIds = [
        ticket.initiatorUserId,
        ticket.opponentUserId,
        ticket.initiatorTeammateId,
        ticket.opponentTeammateId
      ].filter(Boolean);
      await unlockChannelForUsers(ch, participantIds);
    }

    // Get user info for embeds and logs
    const opponentId = ticket.initiatorUserId === dodgerUserId
      ? ticket.opponentUserId
      : ticket.initiatorUserId;
    const [dodgerUser, opponentUser] = await Promise.all([
      interaction.client.users.fetch(dodgerUserId).catch(() => null),
      interaction.client.users.fetch(opponentId).catch(() => null)
    ]);

    // Update original message and ticket channel
    try {
      const ch = interaction.guild.channels.cache.get(ticket.channelId);
      if (ch && sourceMessageId) {
        try {
          const msg = await ch.messages.fetch(sourceMessageId).catch(() => null);
          if (msg) await msg.edit({ components: [] }).catch(() => {});
        } catch (_) {}
      }
      if (ch && ch.type === ChannelType.GuildText) {
        const { container, attachment } = await buildWagerDodgeEmbed(
          dodgerUser,
          opponentUser,
          interaction.user.id,
          new Date()
        );

        // Add close button to the container
        container.addActionRowComponents(buildWagerCloseButtonRow(ticket._id));

        // Send container with attachment in same message for attachment:// to work
        await ch.send({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
          content: 'Use the button below to close the ticket.',
          files: attachment ? [attachment] : []
        });

        // Send log to transcript channel
        try {
          await sendTranscriptToLogs(
            interaction.guild,
            ch,
            `Wager Ticket ${ticket._id} marked as dodge by <@${dodgerUserId}>`,
            ticket
          );
        } catch (_) {}
      }
    } catch (_) {}

    // Send log to wager dodge channel (always attempt this)
    try {
      await sendWagerDodgeLog(
        interaction.guild,
        dodgerUser,
        opponentUser,
        interaction.user.id
      );
    } catch (logErr) {
      LoggerService.warn('Failed to send dodge log:', { error: logErr?.message });
    }

    try {
      return await interaction.editReply({ content: '✅ Dodge recorded.' });
    } catch (e) {
      const code = e?.code ?? e?.rawError?.code;
      if (code !== 10008) throw e;
      return; // silently ignore unknown message in success path
    }
  } catch (error) {
    LoggerService.error('Error in button wager:dodge:apply:', error);
    const msg = { content: '❌ Could not apply the dodge.' };
    if (interaction.deferred || interaction.replied) return interaction.followUp({ ...msg, flags: MessageFlags.Ephemeral });
    return interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handle };

