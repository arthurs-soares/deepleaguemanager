const { getOrCreateServerSettings } = require('../utils/system/serverSettings');
const { getOrCreateRoleConfig } = require('../utils/misc/roleConfig');
const { createGeneralTicketChannel } = require('../utils/tickets/generalTicketChannelManager');
const { sendAndPin } = require('../utils/tickets/pinUtils');
const GeneralTicket = require('../models/ticket/GeneralTicket');
const { buildTicketPanel } = require('../utils/embeds/ticketEmbeds');
const LoggerService = require('./LoggerService');

class TicketService {
  constructor() {
    this.TICKET_TYPES = {
      admin: {
        title: 'Admin Ticket',
      },
      blacklist_appeal: {
        title: 'Blacklist Appeal',
      },
      general: {
        title: 'General Ticket',
      },
      roster: {
        title: 'Roster Ticket',
      }
    };
  }

  /**
       * Open a new ticket for a user
       * @param {import('discord.js').Guild} guild
       * @param {import('discord.js').User} user
       * @param {string} ticketType
       * @param {Object} ticketConfig - Full config from the handler (emoji, description, etc)
       */
  async openTicket(guild, user, ticketType, ticketConfig) {
    try {
      const settings = await getOrCreateServerSettings(guild.id);
      const categoryId = settings.generalTicketsCategoryId;

      if (!categoryId) {
        throw new Error('CATEGORY_NOT_CONFIGURED');
      }

      const category = guild.channels.cache.get(categoryId);
      if (!category) {
        throw new Error('CATEGORY_NOT_FOUND');
      }

      // Check existing tickets
      const existingTicket = await GeneralTicket.findOne({
        discordGuildId: guild.id,
        userId: user.id,
        ticketType,
        status: 'open'
      });

      if (existingTicket && existingTicket.channelId) {
        const existingChannel = guild.channels.cache.get(existingTicket.channelId);
        if (existingChannel) {
          return {
            success: false,
            code: 'TICKET_EXISTS',
            channelId: existingChannel.id
          };
        }
      }

      // Role configs for permissions
      const roleConfig = await getOrCreateRoleConfig(guild.id);
      const adminSupportRoleIds = roleConfig.adminSupportRoleIds || [];
      const supportRoleIds = roleConfig.supportRoleIds || [];
      const moderatorRoleIds = roleConfig.moderatorsRoleIds || [];

      // Create Channel
      const channel = await createGeneralTicketChannel(
        guild,
        category,
        user,
        ticketType,
        adminSupportRoleIds,
        supportRoleIds,
        moderatorRoleIds
      );

      // Create DB Record
      const ticket = await GeneralTicket.create({
        discordGuildId: guild.id,
        channelId: channel.id,
        userId: user.id,
        ticketType,
        status: 'open'
      });

      // Send Panel
      try {
        const panelPayload = buildTicketPanel(ticketConfig, user, ticket._id);
        await sendAndPin(channel, panelPayload, { unpinOld: true });
      } catch (err) {
        LoggerService.warn('Failed to send/pin ticket panel:', { error: err?.message, ticketId: ticket._id });
      }

      // Mentions
      await this._sendMentions(channel, guild, ticketType, ticketConfig, user, {
        adminSupportRoleIds,
        supportRoleIds,
        moderatorRoleIds
      });

      return {
        success: true,
        channelId: channel.id
      };

    } catch (error) {
      LoggerService.error('Error in TicketService.openTicket:', { error: error.message });
      throw error;
    }
  }

  /**
       * Get a ticket by ID
       * @param {string} ticketId
       */
  async getTicket(ticketId) {
    return await GeneralTicket.findById(ticketId);
  }

  /**
       * Close a ticket (Safe update db status)
       * The actual channel deletion is usually handled by `ticketCloseConfirm` or similar.
       * This method serves to update the state if we wanted to soft-close.
       * For now, we mainly use it to fetch valid tickets.
       */
  async getTicketAndValidateClosure(ticketId) {
    // Logic moved from ticketClose.js for validation
    // ... (This part is complex because it involves interaction-specific context like member roles)
    // We will keep the permission check in the handler for now as it relies on interaction.member
    // But we will expose fetching.
    return await GeneralTicket.findById(ticketId);
  }

  async _sendMentions(channel, guild, ticketType, ticketConfig, user, roles) {
    try {
      const rolesToMention = [];
      if (ticketType === 'admin') {
        rolesToMention.push(...roles.adminSupportRoleIds);
      } else {
        rolesToMention.push(...roles.supportRoleIds, ...roles.moderatorRoleIds);
      }

      const validRoleMentions = rolesToMention
        .filter(roleId => guild.roles.cache.has(roleId))
        .map(roleId => `<@&${roleId}>`)
        .join(' ');

      if (validRoleMentions) {
        await channel.send({
          content: `${validRoleMentions} - New ${ticketConfig.title.toLowerCase()} opened by ${user}`,
          allowedMentions: { roles: rolesToMention }
        });
      }
    } catch (err) {
      LoggerService.warn('Failed to mention support roles:', { error: err?.message });
    }
  }
}

module.exports = new TicketService();
