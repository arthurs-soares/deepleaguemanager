const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const WagerTicket = require('../../models/wager/WagerTicket');
const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
const { isDatabaseConnected } = require('../../config/database');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle select for choosing which user dodged (wager)
 * CustomId: wager:dodge:select:<ticketId>:<sourceMessageId>
 */
async function handle(interaction) {
  try {
    const { MessageFlags } = require('discord.js');
    const parts = interaction.customId.split(':');
    const ticketId = parts[3];
    const sourceMessageId = parts[4] && parts[4] !== '0' ? parts[4] : null;
    const dodgerUserId = interaction.values?.[0];

    if (!ticketId || !dodgerUserId) return interaction.deferUpdate();

    // Check database connection
    if (!isDatabaseConnected()) {
      return interaction.reply({ content: '❌ Database is temporarily unavailable.', flags: MessageFlags.Ephemeral });
    }

    // Permissions: only Moderators/Hosters OR Self-Dodge
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([...(rolesCfg?.hostersRoleIds || []), ...(rolesCfg?.moderatorsRoleIds || [])]);
    const hasAllowedRole = interaction.member.roles.cache.some(r => allowedRoleIds.has(r.id));

    // Check if user is dodging themselves (self-dodge)
    const isSelfDodge = dodgerUserId === interaction.user.id;

    if (!hasAllowedRole && !isSelfDodge) {
      return interaction.reply({ content: '❌ Only hosters or moderators can mark others as dodge.', flags: MessageFlags.Ephemeral });
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
      return interaction.reply({ content: '❌ Ticket not found.', flags: MessageFlags.Ephemeral });
    }
    if (ticket.status !== 'open') {
      return interaction.reply({ content: '⚠️ This ticket is not open.', flags: MessageFlags.Ephemeral });
    }

    const confirm = new ButtonBuilder()
      .setCustomId(`wager:dodge:apply:${ticketId}:${dodgerUserId}:${sourceMessageId || '0'}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Confirm Dodge');
    const cancel = new ButtonBuilder()
      .setCustomId(`wager:dodge:cancel:${ticketId}:${sourceMessageId || '0'}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Cancel');

    const row = new ActionRowBuilder().addComponents(confirm, cancel);
    return interaction.update({ content: `You selected: <@${dodgerUserId}> dodged this wager. Do you confirm?`, components: [row] });
  } catch (error) {
    LoggerService.error('Error in select wager:dodge:select:', error);
    const msg = { content: '❌ Could not process the selection.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

