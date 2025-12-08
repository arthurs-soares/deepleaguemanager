/**
 * Ticket command handlers
 * Extracted from ticket.js to comply with max-lines rule
 */
const { MessageFlags } = require('discord.js');
const { createErrorEmbed } = require('../../utils/embeds/embedBuilder');
const { isModeratorOrHoster } = require('../../utils/core/permissions');
const { safeDeferEphemeral } = require('../../utils/core/ack');
const War = require('../../models/war/War');
const WagerTicket = require('../../models/wager/WagerTicket');
const GeneralTicket = require('../../models/ticket/GeneralTicket');
const { sendLog } = require('../../utils/core/logger');
const { sendTranscriptToLogs } = require('../../utils/tickets/transcript');
const { handleAddUser } = require('../../utils/commands/ticketAddUser');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle /ticket close
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleClose(interaction) {
  await safeDeferEphemeral(interaction);

  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const allowed = await isModeratorOrHoster(member, interaction.guild.id);

    if (!allowed) {
      const container = createErrorEmbed(
        'Permission denied',
        'Only administrators, moderators or hosters can use this command.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const channel = interaction.channel;

    const [war, wager, generalTicket] = await Promise.all([
      War.findOne({
        discordGuildId: interaction.guild.id,
        channelId: channel.id
      }),
      WagerTicket.findOne({
        discordGuildId: interaction.guild.id,
        channelId: channel.id
      }),
      GeneralTicket.findOne({
        discordGuildId: interaction.guild.id,
        channelId: channel.id
      })
    ]);

    if (!war && !wager && !generalTicket) {
      const container = createErrorEmbed(
        'Not a ticket',
        'This channel is not a recognized ticket channel.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    await updateTicketStatus(war, wager, generalTicket, interaction.user.id);
    await generateTranscript(interaction, channel, war, wager, generalTicket);
    await deleteChannel(interaction, channel);
    await logTicketClosure(interaction, war, wager, generalTicket);

    return;
  } catch (error) {
    LoggerService.error('Error in /ticket close:', { error: error.message });
    const container = createErrorEmbed(
      'Error',
      error?.message || 'Could not close the ticket.'
    );

    try {
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }
      return interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      });
    } catch (replyError) {
      LoggerService.error('Could not send error reply:', {
        error: replyError.message
      });
    }
  }
}

/**
 * Update ticket status in database
 */
async function updateTicketStatus(war, wager, generalTicket, userId) {
  if (war) {
    war.closedByUserId = userId;
    war.closedAt = new Date();
    await war.save();
  } else if (wager) {
    wager.status = 'closed';
    wager.closedByUserId = userId;
    wager.closedAt = new Date();
    await wager.save();
  } else if (generalTicket) {
    generalTicket.status = 'closed';
    generalTicket.closedByUserId = userId;
    generalTicket.closedAt = new Date();
    await generalTicket.save();
  }
}

/**
 * Generate and send transcript
 */
async function generateTranscript(interaction, channel, war, wager, ticket) {
  try {
    const ticketMetadata = war || wager || ticket;
    const ticketTypeLabel = war ? `War ${war._id}` :
      wager ? `Wager Ticket ${wager._id}` :
        `General ticket (${ticket.ticketType})`;

    const transcriptPromise = sendTranscriptToLogs(
      interaction.guild,
      channel,
      `${ticketTypeLabel} closed via /ticket close by ${interaction.user.tag}`,
      ticketMetadata
    );

    await Promise.race([
      transcriptPromise,
      new Promise((resolve) => setTimeout(resolve, 10000))
    ]);
  } catch (transcriptError) {
    LoggerService.error('Error generating transcript:', {
      error: transcriptError.message
    });
  }
}

/**
 * Delete ticket channel
 */
async function deleteChannel(interaction, channel) {
  try {
    await channel.delete('Ticket closed via /ticket close');
  } catch (err) {
    const container = createErrorEmbed(
      'Close failed',
      `Could not close this ticket: ${err?.message || 'unknown error'}`
    );
    try {
      return await interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (_) {
      // Channel or message likely already gone, ignore
    }
  }
}

/**
 * Log ticket closure
 */
async function logTicketClosure(interaction, war, wager, generalTicket) {
  try {
    if (war) {
      await sendLog(
        interaction.guild,
        'War Ticket Closed',
        `War ${war._id} • Action by: <@${interaction.user.id}>`
      );
    } else if (wager) {
      await sendLog(
        interaction.guild,
        'Wager Ticket Closed',
        `Wager Ticket ${wager._id} • Action by: <@${interaction.user.id}>`
      );
    } else if (generalTicket) {
      const ticketTypeDisplay = {
        admin: 'Admin Ticket',
        blacklist_appeal: 'Blacklist Appeal',
        general: 'General Ticket',
        roster: 'Roster Ticket'
      }[generalTicket.ticketType] || generalTicket.ticketType;

      await sendLog(
        interaction.guild,
        'General Ticket Closed',
        `${ticketTypeDisplay} • Action by: <@${interaction.user.id}>`
      );
    }
  } catch (_) { }
}

module.exports = {
  handleClose,
  handleAddUser
};
