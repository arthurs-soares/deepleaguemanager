const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const {
  getOrCreateServerSettings
} = require('../../../utils/system/serverSettings');
const {
  getOrCreateRoleConfig
} = require('../../../utils/misc/roleConfig');
const {
  createWagerChannel,
  CategoryFullError,
  ServerChannelLimitError,
  findAvailableWagerCategory
} = require('../../../utils/wager/wagerChannelManager');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const WagerTicket = require('../../../models/wager/WagerTicket');
const LoggerService = require('../../../services/LoggerService');
const { colors, emojis } = require('../../../config/botConfig');
const { countOpenWagerTickets, MAX_OPEN_WAGER_TICKETS } = require('../../../utils/wager/wagerTicketLimits');

/**
 * Check if a member has the no-wagers role
 * @param {GuildMember} member - Guild member
 * @param {string} noWagersRoleId - Role ID from config
 * @returns {boolean}
 */
function hasNoWagersRole(member, noWagersRoleId) {
  if (!member || !noWagersRoleId) return false;
  return member.roles.cache.has(noWagersRoleId);
}

/**
 * Create wager ticket channel and panel
 * CustomId: wager:createTicket:<opponentUserId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , opponentUserId] = interaction.customId.split(':');
    if (!opponentUserId) return interaction.editReply({ content: '❌ Missing opponent.' });

    const initiatorId = interaction.user.id;

    // War wagers removed: no leader/co-leader restrictions for wagers
    const roleCfg = await getOrCreateRoleConfig(interaction.guild.id);

    // Check if initiator has no-wagers role
    const initiatorMember = await interaction.guild.members
      .fetch(initiatorId).catch(() => null);
    if (hasNoWagersRole(initiatorMember, roleCfg?.noWagersRoleId)) {
      return interaction.editReply({
        content: '❌ You have opted out of wagers. Remove the no-wagers role.'
      });
    }

    // Check if opponent has no-wagers role
    const opponentMember = await interaction.guild.members
      .fetch(opponentUserId).catch(() => null);
    if (hasNoWagersRole(opponentMember, roleCfg?.noWagersRoleId)) {
      return interaction.editReply({
        content: `❌ <@${opponentUserId}> has opted out of wagers.`
      });
    }

    // Check if initiator has blacklist role
    if (roleCfg?.blacklistRoleIds?.some(id => initiatorMember.roles.cache.has(id))) {
      return interaction.editReply({
        content: '❌ You are blacklisted from using wager systems.'
      });
    }

    // Check if opponent has blacklist role
    if (roleCfg?.blacklistRoleIds?.some(id => opponentMember.roles.cache.has(id))) {
      return interaction.editReply({
        content: `❌ <@${opponentUserId}> is blacklisted from wagers.`
      });
    }

    // Check ticket limits for both users
    const initiatorOpenTickets = await countOpenWagerTickets(interaction.guild.id, initiatorId);
    if (initiatorOpenTickets >= MAX_OPEN_WAGER_TICKETS) {
      return interaction.editReply({
        content: `❌ You already have **${MAX_OPEN_WAGER_TICKETS}** open wager tickets. Please close one before creating another.`
      });
    }

    const opponentOpenTickets = await countOpenWagerTickets(interaction.guild.id, opponentUserId);
    if (opponentOpenTickets >= MAX_OPEN_WAGER_TICKETS) {
      return interaction.editReply({
        content: `❌ <@${opponentUserId}> already has **${MAX_OPEN_WAGER_TICKETS}** open wager tickets.`
      });
    }

    const settings = await getOrCreateServerSettings(interaction.guild.id);

    // Find an available category from the configured wager categories
    const { category, error: catError } = findAvailableWagerCategory(
      interaction.guild,
      settings
    );

    if (catError) {
      return interaction.editReply({ content: catError });
    }

    const roleIdsHosters = roleCfg?.hostersRoleIds || [];

    const initiator = interaction.user;
    const opponent = await interaction.client.users.fetch(opponentUserId).catch(() => null);
    if (!opponent) return interaction.editReply({ content: '❌ Opponent not found.' });

    const userIds = new Set([initiator.id, opponent.id]);
    const channel = await createWagerChannel(interaction.guild, category, initiator, opponent, userIds, roleIdsHosters);

    const ticket = await WagerTicket.create({
      discordGuildId: interaction.guild.id,
      channelId: channel.id,
      initiatorUserId: initiator.id,
      opponentUserId: opponent.id,
    });

    const container = new ContainerBuilder();
    container.setAccentColor(colors.primary);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.depthsWager} Wager Ticket`);

    const descText = new TextDisplayBuilder()
      .setContent(
        '⚠️ **Chat is locked** until the wager is accepted.\n\n' +
        'Use the buttons below to accept or close the ticket.'
      );

    const timestampText = new TextDisplayBuilder()
      .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

    container.addTextDisplayComponents(titleText, descText, timestampText);

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`wager:accept:${ticket._id}`).setStyle(ButtonStyle.Success).setLabel('Accept Wager'),
      new ButtonBuilder().setCustomId(`wager:markDodge:${ticket._id}`).setStyle(ButtonStyle.Danger).setLabel('Mark Dodge'),
      new ButtonBuilder().setCustomId(`wager:closeTicket:${ticket._id}`).setStyle(ButtonStyle.Secondary).setLabel('Close Ticket')
    );

    try {
      await channel.send({
        content: `<@${initiator.id}> vs <@${opponent.id}>`,
        allowedMentions: { users: [initiator.id, opponent.id] }
      });
    } catch (_) { }

    // Note: Hosters are NOT mentioned on ticket creation
    // They will be mentioned only when someone clicks the "Accept" button

    try {
      await sendAndPin(
        channel,
        { components: [container, actionRow], flags: MessageFlags.IsComponentsV2 },
        { unpinOld: true }
      );
    } catch (_) { }

    return interaction.editReply({
      content: `✅ Wager ticket created: <#${channel.id}>`
    });
  } catch (error) {
    // Handle category full error with user-friendly message
    if (error instanceof CategoryFullError) {
      LoggerService.warn('Wager category full:', error.message);
      const msg = {
        content: '❌ The wager category is full (50 channels max).\n' +
          'Please ask a staff member to close old wager tickets.',
        flags: MessageFlags.Ephemeral
      };
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(msg);
      }
      return interaction.reply(msg);
    }

    // Handle server channel limit (500 max)
    if (error instanceof ServerChannelLimitError) {
      LoggerService.warn('Server channel limit reached (500):', error.message);
      const msg = {
        content: '❌ The server has reached the maximum of 500 channels.\n' +
          'Please ask a staff member to delete unused channels.',
        flags: MessageFlags.Ephemeral
      };
      if (interaction.deferred || interaction.replied) {
        return interaction.followUp(msg);
      }
      return interaction.reply(msg);
    }

    LoggerService.error('Error creating wager ticket:', error);
    const msg = {
      content: '❌ Could not create the wager ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

