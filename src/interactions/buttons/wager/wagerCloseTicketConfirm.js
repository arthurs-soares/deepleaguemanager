const { PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { sendLog } = require('../../../utils/core/logger');
const { sendTranscriptToLogs } = require('../../../utils/tickets/transcript');
const LoggerService = require('../../../services/LoggerService');

const { isDatabaseConnected, withDatabase } = require('../../../config/database');

// Helpers
async function hasClosePermission(member, guildId) {
  const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);
  if (!isDatabaseConnected()) return !!isAdmin;
  const cfg = await getOrCreateRoleConfig(guildId);
  const allowed = new Set([...(cfg?.hostersRoleIds || []), ...(cfg?.moderatorsRoleIds || [])]);
  const hasRole = member.roles.cache.some(r => allowed.has(r.id));
  return isAdmin || hasRole;
}

async function getWagerChannel(guild, ticketId, channelId) {
  let ticket = await withDatabase(() => WagerTicket.findById(ticketId), null);

  // Fallback: search by channel if findById fails
  if (!ticket && channelId) {
    ticket = await withDatabase(
      () => WagerTicket.findOne({
        discordGuildId: guild.id,
        channelId
      }),
      null
    );
  }

  if (!ticket || !ticket.channelId) return { error: '⚠️ Wager channel not found.' };
  const channel = guild.channels.cache.get(ticket.channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return { error: '⚠️ This ticket has already been closed or the channel is invalid.' };
  }
  return { ticket, channel };
}

/**
 * Confirm and execute wager ticket closure
 * CustomId: wager:closeTicket:confirm:<ticketId>
 */
async function handle(interaction) {
  try {
    await interaction.deferUpdate();

    const [, , , ticketId] = interaction.customId.split(':');
    if (!ticketId) {
      return interaction.followUp({
        content: '❌ Ticket ID not provided.',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await hasClosePermission(member, interaction.guild.id))) {
      return interaction.followUp({
        content: '❌ Only hosters, moderators or administrators can close the ticket.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { error, ticket, channel } = await getWagerChannel(
      interaction.guild,
      ticketId,
      interaction.channel.id
    );
    if (error) {
      return interaction.followUp({
        content: error,
        flags: MessageFlags.Ephemeral
      });
    }

    // Update ticket record
    ticket.status = 'closed';
    ticket.closedByUserId = interaction.user.id;
    ticket.closedAt = new Date();
    await ticket.save();

    // Generate transcript before deleting the channel
    try {
      await interaction.followUp({
        content: '🧹 Closing this wager ticket (generating transcript)...',
        flags: MessageFlags.Ephemeral
      });
    } catch (e) {
      const code = e?.code ?? e?.rawError?.code;
      if (code !== 10008) throw e;
    }

    // Send transcript to logs with enhanced metadata
    try {
      await sendTranscriptToLogs(
        interaction.guild,
        channel,
        `Wager Ticket ${ticket._id} closed by ${interaction.user.tag}`,
        ticket
      );
    } catch (_) { }

    // Delete the channel
    try {
      await channel.delete('Wager ticket closed via button.');
    } catch (err) {
      try {
        await interaction.followUp({
          content: `❌ Could not close the ticket: ${err?.message || 'unknown error'}`,
          flags: MessageFlags.Ephemeral
        });
      } catch (e) {
        const code = e?.code ?? e?.rawError?.code;
        if (code !== 10008) throw e;
        LoggerService.error('Failed to delete wager ticket channel:', { error: err?.message });
      }
      return;
    }

    try {
      await sendLog(
        interaction.guild,
        'Wager Ticket Closed',
        `Wager Ticket ${ticket._id} • Action by: <@${interaction.user.id}>`
      );
    } catch (_) { }

    return;
  } catch (error) {
    LoggerService.error('Error confirming wager ticket closure:', { error: error?.message });
    const msg = {
      content: '❌ Could not close the ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

