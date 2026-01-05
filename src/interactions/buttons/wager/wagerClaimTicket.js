const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');

/** Max age (ms) before button click is skipped */
const MAX_AGE_MS = 2500;

/**
 * Claim a wager ticket - only hosters can claim
 * Removes all hoster roles permission and grants only to the claimer
 * CustomId: wager:claim:<ticketId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('wager:claim skipped (expired)', { age });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , ticketId] = interaction.customId.split(':');
    if (!ticketId) {
      return interaction.editReply({ content: '❌ Ticket ID not provided.' });
    }

    if (!isDatabaseConnected()) {
      return interaction.editReply({
        content: '❌ Database is temporarily unavailable.'
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
      return interaction.editReply({ content: '⚠️ This ticket is not open.' });
    }

    if (!ticket.acceptedAt) {
      return interaction.editReply({
        content: '⚠️ Wager must be accepted before claiming.'
      });
    }

    if (ticket.claimedByUserId) {
      return interaction.editReply({
        content: `⚠️ Already claimed by <@${ticket.claimedByUserId}>.`
      });
    }

    const cfg = await getOrCreateRoleConfig(interaction.guild.id);
    const hosterRoleIds = cfg?.hostersRoleIds || [];
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isHoster = member.roles.cache.some(r => hosterRoleIds.includes(r.id));
    const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isHoster && !isAdmin) {
      return interaction.editReply({
        content: '❌ Only hosters can claim a ticket.'
      });
    }

    const channel = interaction.guild.channels.cache.get(ticket.channelId);
    if (!channel) {
      return interaction.editReply({ content: '❌ Channel not found.' });
    }

    // Remove permission for all hoster roles (parallel for speed)
    const permPromises = hosterRoleIds
      .filter(roleId => interaction.guild.roles.cache.has(roleId))
      .map(roleId =>
        channel.permissionOverwrites.edit(roleId, {
          ViewChannel: false,
          SendMessages: false,
          ReadMessageHistory: false
        }).catch(() => {})
      );
    await Promise.all(permPromises);

    // Grant permission only to the claimer
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });

    ticket.claimedAt = new Date();
    ticket.claimedByUserId = interaction.user.id;
    await ticket.save();

    try {
      await channel.send({
        content: `🎫 Ticket claimed by <@${interaction.user.id}>.`,
        allowedMentions: { users: [interaction.user.id] }
      });
    } catch (_) {}

    return interaction.editReply({ content: '✅ Ticket claimed successfully.' });
  } catch (error) {
    LoggerService.error('Error in button wager:claim:', error);
    const msg = {
      content: '❌ Could not claim the ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
