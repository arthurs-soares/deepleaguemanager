const {
  ChannelType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const {
  getOrCreateServerSettings
} = require('../../../utils/system/serverSettings');
const {
  getOrCreateRoleConfig
} = require('../../../utils/misc/roleConfig');
const {
  createWagerChannel2v2
} = require('../../../utils/wager/wagerChannelManager');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const {
  countOpenWagerTickets
} = require('../../../utils/wager/wagerTicketLimits');
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
 * Create 2v2 wager ticket channel and panel
 * CustomId: wager:createTicket2v2:<teammateId>:<opponent1Id>:<opponent2Id>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const [, , teammateId, opponent1Id, opponent2Id] = parts;

    if (!teammateId || !opponent1Id || !opponent2Id) {
      return interaction.editReply({ content: '❌ Missing participants.' });
    }

    const initiatorId = interaction.user.id;
    const guildId = interaction.guild.id;
    const allUserIds = [initiatorId, teammateId, opponent1Id, opponent2Id];

    // Check ticket limit for all participants
    const counts = await Promise.all(
      allUserIds.map(uid => countOpenWagerTickets(guildId, uid))
    );

    for (let i = 0; i < allUserIds.length; i++) {
      if (counts[i] >= MAX_OPEN_WAGER_TICKETS_PER_USER) {
        return interaction.editReply({
          content: `❌ <@${allUserIds[i]}> has reached the maximum ` +
            `of **${MAX_OPEN_WAGER_TICKETS_PER_USER}** open wager tickets.`
        });
      }
    }

    const roleCfg = await getOrCreateRoleConfig(guildId);

    // Check if any participant has no-wagers role
    const members = await Promise.all(
      allUserIds.map(uid => interaction.guild.members.fetch(uid).catch(() => null))
    );
    for (let i = 0; i < allUserIds.length; i++) {
      if (hasNoWagersRole(members[i], roleCfg?.noWagersRoleId)) {
        return interaction.editReply({
          content: `❌ <@${allUserIds[i]}> has opted out of wagers.`
        });
      }
    }

    const settings = await getOrCreateServerSettings(guildId);

    const catId = settings.wagerCategoryId;
    if (!catId) {
      return interaction.editReply({
        content: '⚠️ Category for wager channels not configured. ' +
          'Set it in /config → Channels.'
      });
    }

    const category = interaction.guild.channels.cache.get(catId);
    if (!category || category.type !== ChannelType.GuildCategory) {
      return interaction.editReply({
        content: '❌ Configured category is invalid.'
      });
    }

    const roleIdsHosters = roleCfg?.hostersRoleIds || [];

    // Fetch all users
    const [initiator, teammate, opponent1, opponent2] = await Promise.all([
      interaction.client.users.fetch(initiatorId).catch(() => null),
      interaction.client.users.fetch(teammateId).catch(() => null),
      interaction.client.users.fetch(opponent1Id).catch(() => null),
      interaction.client.users.fetch(opponent2Id).catch(() => null)
    ]);

    if (!initiator || !teammate || !opponent1 || !opponent2) {
      return interaction.editReply({
        content: '❌ Could not find one or more participants.'
      });
    }

    const userIds = new Set(allUserIds);
    const channel = await createWagerChannel2v2(
      interaction.guild,
      category,
      initiator,
      teammate,
      opponent1,
      opponent2,
      userIds,
      roleIdsHosters
    );

    const ticket = await WagerTicket.create({
      discordGuildId: guildId,
      channelId: channel.id,
      initiatorUserId: initiatorId,
      opponentUserId: opponent1Id,
      is2v2: true,
      initiatorTeammateId: teammateId,
      opponentTeammateId: opponent2Id
    });

    const container = new ContainerBuilder();
    container.setAccentColor(colors.primary);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.depthsWager} 2v2 Wager Ticket`);

    const teamsText = new TextDisplayBuilder()
      .setContent(
        `**Team A:** <@${initiatorId}> & <@${teammateId}>\n` +
        `**Team B:** <@${opponent1Id}> & <@${opponent2Id}>`
      );

    const descText = new TextDisplayBuilder()
      .setContent(
        '⚠️ **Chat is locked** until the wager is accepted.\n\n' +
        'Use the buttons below to accept or close the ticket.'
      );

    const timestampText = new TextDisplayBuilder()
      .setContent(`*<t:${Math.floor(Date.now() / 1000)}:F>*`);

    container.addTextDisplayComponents(
      titleText,
      teamsText,
      descText,
      timestampText
    );

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`wager:accept:${ticket._id}`)
        .setStyle(ButtonStyle.Success)
        .setLabel('Accept Wager'),
      new ButtonBuilder()
        .setCustomId(`wager:closeTicket:${ticket._id}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Close Ticket')
    );

    // Mention all participants
    try {
      await channel.send({
        content: `<@${initiatorId}> & <@${teammateId}> vs ` +
          `<@${opponent1Id}> & <@${opponent2Id}>`,
        allowedMentions: { users: allUserIds }
      });
    } catch (_) {}

    try {
      await sendAndPin(
        channel,
        { components: [container, actionRow], flags: MessageFlags.IsComponentsV2 },
        { unpinOld: true }
      );
    } catch (_) {}

    return interaction.editReply({
      content: `✅ 2v2 Wager ticket created: <#${channel.id}>`
    });
  } catch (error) {
    LoggerService.error('Error creating 2v2 wager ticket:', error);
    const msg = {
      content: '❌ Could not create the 2v2 wager ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
