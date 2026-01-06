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
const {
  validateWagerParticipants
} = require('../../../utils/wager/wagerTicketLimits');
const { safeDeferEphemeral } = require('../../../utils/core/ack');

/** Max age (ms) before button click is skipped */
const MAX_AGE_MS = 2500;

/**
 * Create wager ticket channel and panel
 * CustomId: wager:createTicket:<opponentUserId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('wager:createTicket skipped (expired)', { age });
      return;
    }

    await safeDeferEphemeral(interaction);
    if (!interaction.deferred) return; // Defer failed, likely expired

    const [, , opponentUserId] = interaction.customId.split(':');
    if (!opponentUserId) {
      return interaction.editReply({ content: '❌ Missing opponent.' });
    }

    const initiatorId = interaction.user.id;
    const roleCfg = await getOrCreateRoleConfig(interaction.guild.id);

    // Validate participants using shared utility
    const validationError = await validateWagerParticipants(
      interaction.guild,
      [initiatorId, opponentUserId],
      initiatorId,
      roleCfg
    );
    if (validationError) {
      return interaction.editReply({ content: validationError });
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

