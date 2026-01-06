const { PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { colors, emojis } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');
const { safeDeferEphemeral } = require('../../../utils/core/ack');

const { isDatabaseConnected, withDatabase } = require('../../../config/database');

/** Max age (ms) before button click is skipped */
const MAX_AGE_MS = 2500;

async function hasClosePermission(member, guildId) {
  const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);
  if (!isDatabaseConnected()) return !!isAdmin; // allow only admins while DB is offline
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
 * Show confirmation dialog before closing wager ticket
 * CustomId: wager:closeTicket:<ticketId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('wager:closeTicket skipped (expired)', { age });
      return;
    }

    await safeDeferEphemeral(interaction);
    if (!interaction.deferred) return; // Defer failed, likely expired

    const [, , ticketId] = interaction.customId.split(':');
    if (!ticketId) return interaction.editReply({ content: '❌ Ticket ID not provided.' });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await hasClosePermission(member, interaction.guild.id))) {
      return interaction.editReply({ content: '❌ Only hosters, moderators or administrators can close the ticket.' });
    }

    const { error, ticket, channel } = await getWagerChannel(
      interaction.guild,
      ticketId,
      interaction.channel.id
    );
    if (error) return interaction.editReply({ content: error });

    // Fetch users for display
    const [initiator, opponent] = await Promise.all([
      interaction.client.users.fetch(ticket.initiatorUserId).catch(() => null),
      interaction.client.users.fetch(ticket.opponentUserId).catch(() => null)
    ]);

    const initiatorTag = initiator ? initiator.tag : `Unknown User (${ticket.initiatorUserId})`;
    const opponentTag = opponent ? opponent.tag : `Unknown User (${ticket.opponentUserId})`;

    // Build confirmation container
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning} Confirm Wager Ticket Closure`);

    const descText = new TextDisplayBuilder()
      .setContent('Are you sure you want to close this wager ticket? This action cannot be undone.');

    const wagerType = ticket.isWar ? 'War Wager' : 'Regular Wager';
    const detailsText = new TextDisplayBuilder()
      .setContent(
        `**Wager ID:** ${ticket._id}\n` +
        `**Type:** ${wagerType}\n` +
        `**Participants:** ${initiatorTag} vs ${opponentTag}\n` +
        `**Created:** <t:${Math.floor(ticket.createdAt.getTime() / 1000)}:R>\n` +
        `**Channel:** ${channel}`
      );

    container.addTextDisplayComponents(titleText, descText, detailsText);

    // Create confirmation buttons
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wager:closeTicket:confirm:${ticketId}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Close'),
      new ButtonBuilder()
        .setCustomId(`wager:closeTicket:cancel:${ticketId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    await interaction.editReply({
      content: '',
      components: [container, actionRow],
      flags: MessageFlags.IsComponentsV2
    });

  } catch (error) {
    LoggerService.error('Error showing wager ticket close confirmation:', { error: error?.message });
    const msg = { content: '❌ Could not show confirmation dialog.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

