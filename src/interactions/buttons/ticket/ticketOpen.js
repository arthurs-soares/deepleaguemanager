const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { createGeneralTicketChannel } = require('../../../utils/tickets/generalTicketChannelManager');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const GeneralTicket = require('../../../models/ticket/GeneralTicket');
const { emojis, colors } = require('../../../config/botConfig');
const { hasRegistrationAccess } = require('../../../utils/core/permissions');
const LoggerService = require('../../../services/LoggerService');

/**
 * Ticket type configurations
 */
const TICKET_TYPES = {
  admin: {
    emoji: emojis.warning || '⚠️',
    title: 'Admin Ticket',
    description: 'This ticket is for reporting chasebannable rule violations. Please provide detailed information about the incident.',
    color: colors.error
  },
  blacklist_appeal: {
    emoji: emojis.blacklistAppeal,
    title: 'Blacklist Appeal',
    description: 'This ticket is for appealing a blacklist. Please explain your situation and why you believe the blacklist should be reconsidered.',
    color: colors.primary
  },
  general: {
    emoji: emojis.generalChat,
    title: 'General Ticket',
    description: 'This ticket is for general inquiries and server-related questions. Our support team will assist you shortly.',
    color: colors.general
  },
  roster: {
    emoji: emojis.rosters || '📋',
    title: 'Roster Ticket',
    description: 'This ticket is for roster registration and editing. Please provide the details of your roster request.',
    color: colors.success
  }
};

/**
 * Handle ticket opening for all ticket types
 * CustomId: ticket:open:<ticketType>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , ticketType] = interaction.customId.split(':');
    if (!ticketType || !TICKET_TYPES[ticketType]) {
      return interaction.editReply({ content: '❌ Invalid ticket type.' });
    }

    // Check registration access for roster tickets
    if (ticketType === 'roster') {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const canAccess = await hasRegistrationAccess(member, interaction.guild.id);
      if (!canAccess) {
        return interaction.editReply({
          content: '❌ You do not have permission to create roster tickets. Please contact an administrator if you believe this is an error.'
        });
      }
    }

    const settings = await getOrCreateServerSettings(interaction.guild.id);
    const roleConfig = await getOrCreateRoleConfig(interaction.guild.id);

    // Check if category is configured
    const categoryId = settings.generalTicketsCategoryId;
    if (!categoryId) {
      return interaction.editReply({
        content: '❌ General tickets category is not configured. Please contact an administrator.'
      });
    }

    const category = interaction.guild.channels.cache.get(categoryId);
    if (!category) {
      return interaction.editReply({
        content: '❌ General tickets category not found. Please contact an administrator.'
      });
    }

    // Check if user already has an open ticket of this type
    const existingTicket = await GeneralTicket.findOne({
      discordGuildId: interaction.guild.id,
      userId: interaction.user.id,
      ticketType,
      status: 'open'
    });

    if (existingTicket && existingTicket.channelId) {
      const existingChannel = interaction.guild.channels.cache.get(existingTicket.channelId);
      if (existingChannel) {
        return interaction.editReply({
          content: `❌ You already have an open ${TICKET_TYPES[ticketType].title.toLowerCase()}: <#${existingChannel.id}>`
        });
      }
    }

    // Create ticket channel
    const adminSupportRoleIds = roleConfig.adminSupportRoleIds || [];
    const supportRoleIds = roleConfig.supportRoleIds || [];
    const moderatorRoleIds = roleConfig.moderatorsRoleIds || [];

    const channel = await createGeneralTicketChannel(
      interaction.guild,
      category,
      interaction.user,
      ticketType,
      adminSupportRoleIds,
      supportRoleIds,
      moderatorRoleIds
    );

    // Create ticket record
    const ticket = await GeneralTicket.create({
      discordGuildId: interaction.guild.id,
      channelId: channel.id,
      userId: interaction.user.id,
      ticketType,
      status: 'open'
    });

    // Build ticket panel
    const config = TICKET_TYPES[ticketType];
    const container = new ContainerBuilder();
    container.setAccentColor(config.color);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${config.emoji} ${config.title}`);

    const descText = new TextDisplayBuilder()
      .setContent(config.description);

    const userText = new TextDisplayBuilder()
      .setContent(`**Opened by:** ${interaction.user}`);

    const timestampText = new TextDisplayBuilder()
      .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

    container.addTextDisplayComponents(titleText, descText, userText, timestampText);

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket:close:${ticket._id}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Close Ticket')
    );

    // Send panel to ticket channel
    try {
      await sendAndPin(channel, {
        components: [container, actionRow],
        flags: MessageFlags.IsComponentsV2
      }, { unpinOld: true });
    } catch (err) {
      LoggerService.warn('Failed to send/pin ticket panel:', { error: err?.message });
    }

    // Mention support roles based on ticket type
    try {
      const rolesToMention = [];

      // Admin tickets: only admin support roles
      if (ticketType === 'admin') {
        rolesToMention.push(...adminSupportRoleIds);
      } else {
        // Other tickets: support roles and moderators
        rolesToMention.push(...supportRoleIds, ...moderatorRoleIds);
      }

      // Filter out invalid roles and create mentions
      const validRoleMentions = rolesToMention
        .filter(roleId => interaction.guild.roles.cache.has(roleId))
        .map(roleId => `<@&${roleId}>`)
        .join(' ');

      if (validRoleMentions) {
        await channel.send({
          content: `${validRoleMentions} - New ${config.title.toLowerCase()} opened by ${interaction.user}`,
          allowedMentions: { roles: rolesToMention }
        });
      }
    } catch (err) {
      LoggerService.warn('Failed to mention support roles:', { error: err?.message });
    }

    return interaction.editReply({
      content: `✅ ${config.title} created: <#${channel.id}>`
    });

  } catch (error) {
    LoggerService.error('Error opening ticket:', { error: error?.message });
    const msg = { content: '❌ Could not create the ticket.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

