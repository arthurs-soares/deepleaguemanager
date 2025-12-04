const { ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder } = require('@discordjs/builders');
const WagerTicket = require('../../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { colors, emojis } = require('../../../config/botConfig');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');

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
    const isOpponent = ticket.opponentUserId === interaction.user.id;
    const isInitiator = ticket.initiatorUserId === interaction.user.id;

    // Initiator cannot accept their own wager (only opponent or team can)
    if (isInitiator && !isTeam) {
      return interaction.editReply({
        content: '❌ You cannot accept your own wager. Only the challenged user can accept.'
      });
    }

    if (!isTeam && !isOpponent) {
      return interaction.editReply({
        content: '❌ Only the challenged user, hosters, moderators or administrators can accept the wager.'
      });
    }

    const channel = interaction.guild.channels.cache.get(ticket.channelId);
    if (!channel) return interaction.editReply({ content: '❌ Ticket channel not found.' });

    // Mark ticket as accepted (atomic update to prevent race conditions)
    ticket.acceptedAt = new Date();
    ticket.acceptedByUserId = interaction.user.id;
    await ticket.save();

    // Disable the Accept button on the original message to prevent multiple acceptances
    try {
      await interaction.message.edit({ components: [] });
    } catch (err) {
      LoggerService.warn('Failed to disable accept button:', { error: err?.message });
    }

    // Mention hosters (roles) to evaluate and decide - ONLY on acceptance, not creation
    const hosterRoleIds = cfg?.hostersRoleIds || [];
    const hostersMention = hosterRoleIds.length ? hosterRoleIds.map(id => `<@&${id}>`).join(' ') : null;
    const participantsMention = `<@${ticket.initiatorUserId}> vs <@${ticket.opponentUserId}>`;

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
    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.depthsWager} Winner Decision`);

    const descText = new TextDisplayBuilder()
      .setContent('Select the winner (Depths). Only Hosters/Moderators can click.');

    const timestampText = new TextDisplayBuilder()
      .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

    container.addTextDisplayComponents(titleText, descText, timestampText);
    container.addSeparatorComponents(new SeparatorBuilder());

    // Initiator winner section with inline button
    const initiatorSection = new SectionBuilder();
    const initiatorText = new TextDisplayBuilder()
      .setContent(`**Initiator:** <@${ticket.initiatorUserId}>`);
    initiatorSection.addTextDisplayComponents(initiatorText);
    initiatorSection.setButtonAccessory(button =>
      button
        .setCustomId(`wager:decideWinner:${ticket._id}:initiator:depths`)
        .setStyle(ButtonStyle.Success)
        .setLabel('Initiator Won')
    );
    container.addSectionComponents(initiatorSection);

    // Opponent winner section with inline button
    const opponentSection = new SectionBuilder();
    const opponentText = new TextDisplayBuilder()
      .setContent(`**Opponent:** <@${ticket.opponentUserId}>`);
    opponentSection.addTextDisplayComponents(opponentText);
    opponentSection.setButtonAccessory(button =>
      button
        .setCustomId(`wager:decideWinner:${ticket._id}:opponent:depths`)
        .setStyle(ButtonStyle.Primary)
        .setLabel('Opponent Won')
    );
    container.addSectionComponents(opponentSection);

    const controlRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wager:claim:${ticket._id}`).setStyle(ButtonStyle.Success).setLabel('Claim Ticket'),
      new ButtonBuilder().setCustomId(`wager:closeTicket:${ticket._id}`).setStyle(ButtonStyle.Secondary).setLabel('Close + Transcript'),
      new ButtonBuilder().setCustomId(`wager:markDodge:${ticket._id}`).setStyle(ButtonStyle.Danger).setLabel('Mark Dodge')
    );

    await sendAndPin(channel, { components: [container, controlRow], flags: MessageFlags.IsComponentsV2 }, { unpinOld: true });

    return interaction.editReply({ content: '✅ Pinned panel sent to ticket channel.' });
  } catch (error) {
    LoggerService.error('Error in button wager:accept:', error);
    const msg = { content: '❌ Could not accept the wager.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

