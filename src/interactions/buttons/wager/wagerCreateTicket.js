const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { createWagerChannel } = require('../../../utils/wager/wagerChannelManager');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const { countOpenWagerTickets } = require('../../../utils/wager/wagerTicketLimits');
const WagerTicket = require('../../../models/wager/WagerTicket');
const LoggerService = require('../../../services/LoggerService');
const { colors, emojis } = require('../../../config/botConfig');

const MAX_OPEN_WAGER_TICKETS_PER_USER = 4;

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
    const guildId = interaction.guild.id;

    // Check ticket limit for both initiator and opponent
    const [initiatorCount, opponentCount] = await Promise.all([
      countOpenWagerTickets(guildId, initiatorId),
      countOpenWagerTickets(guildId, opponentUserId)
    ]);

    if (initiatorCount >= MAX_OPEN_WAGER_TICKETS_PER_USER) {
      return interaction.editReply({
        content: `❌ You have reached the maximum of **${MAX_OPEN_WAGER_TICKETS_PER_USER}** open wager tickets.`
      });
    }

    if (opponentCount >= MAX_OPEN_WAGER_TICKETS_PER_USER) {
      return interaction.editReply({
        content: `❌ <@${opponentUserId}> has reached the maximum of **${MAX_OPEN_WAGER_TICKETS_PER_USER}** open wager tickets.`
      });
    }

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

    const settings = await getOrCreateServerSettings(interaction.guild.id);

    // Category selection: only Wager Category is used for player-to-player wagers
    const wagerCatId = settings.wagerCategoryId;
    const catId = wagerCatId;

    if (!catId) {
      return interaction.editReply({ content: '⚠️ Category for wager channels not configured. Set it in /config → Channels.' });
    }

    const category = interaction.guild.channels.cache.get(catId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({ content: '❌ Configured category is invalid.' });
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
      new ButtonBuilder().setCustomId(`wager:closeTicket:${ticket._id}`).setStyle(ButtonStyle.Secondary).setLabel('Close Ticket')
    );

    try {
      await channel.send({
        content: `<@${initiator.id}> vs <@${opponent.id}>`,
        allowedMentions: { users: [initiator.id, opponent.id] }
      });
    } catch (_) {}

    // Note: Hosters are NOT mentioned on ticket creation
    // They will be mentioned only when someone clicks the "Accept" button

    try { await sendAndPin(channel, { components: [container, actionRow], flags: MessageFlags.IsComponentsV2 }, { unpinOld: true }); } catch (_) {}

    return interaction.editReply({ content: `✅ Wager ticket created: <#${channel.id}>` });
  } catch (error) {
    LoggerService.error('Error creating wager ticket:', error);
    const msg = { content: '❌ Could not create the wager ticket.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

