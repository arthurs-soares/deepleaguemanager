const { ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder } = require('@discordjs/builders');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { colors, emojis } = require('../../../config/botConfig');
const { sendLog } = require('../../../utils/core/logger');
const { getOpponentGuildId } = require('../../../utils/war/warUtils');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { sendAndPin } = require('../../../utils/tickets/pinUtils');
const { createDisabledWarConfirmationButtons } = require('../../../utils/war/warEmbedBuilder');
const { createSafeActionRow } = require('../../../utils/validation/componentValidation');
const LoggerService = require('../../../services/LoggerService');
const { safeDeferEphemeral } = require('../../../utils/core/ack');

/** Max age (ms) before button click is skipped */
const MAX_AGE_MS = 2500;

/**
 * Build the war result container with winner buttons
 * @param {Object} war - War document
 * @param {Object} guildA - Guild A document
 * @param {Object} guildB - Guild B document
 * @returns {ContainerBuilder}
 */
function buildWarResultContainer(war, guildA, guildB) {
  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder().setContent(`# ${emojis.swords} War Result`);
  const descText = new TextDisplayBuilder()
    .setContent(
      `War between ${guildA?.name} and ${guildB?.name}\n` +
      `Date/Time: <t:${Math.floor(new Date(war.scheduledAt).getTime() / 1000)}:F>\n\n` +
      'Use the buttons below to declare the winner (Hosters/Moderators/Admins only).'
    );

  container.addTextDisplayComponents(titleText, descText);
  container.addSeparatorComponents(new SeparatorBuilder());

  const buttonData = [
    { customId: `war:declareWinner:${war._id}:${guildA._id}`, style: ButtonStyle.Success, label: `${guildA?.name} Won` },
    { customId: `war:declareWinner:${war._id}:${guildB._id}`, style: ButtonStyle.Success, label: `${guildB?.name} Won` }
  ];
  const safeResult = createSafeActionRow(buttonData, { maxLabelLength: 38 });

  // Guild A section
  const guildASection = new SectionBuilder();
  guildASection.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${guildA?.name}**`));
  guildASection.setButtonAccessory(btn =>
    btn.setCustomId(safeResult.buttons[0].customId).setStyle(safeResult.buttons[0].style).setLabel(safeResult.buttons[0].label)
  );
  container.addSectionComponents(guildASection);

  // Guild B section
  const guildBSection = new SectionBuilder();
  guildBSection.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${guildB?.name}**`));
  guildBSection.setButtonAccessory(btn =>
    btn.setCustomId(safeResult.buttons[1].customId).setStyle(safeResult.buttons[1].style).setLabel(safeResult.buttons[1].label)
  );
  container.addSectionComponents(guildBSection);

  return container;
}

/**
 * Build control row buttons for war ticket
 * @param {string} warId - War ID
 * @returns {ActionRowBuilder}
 */
function buildControlRow(warId) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`war:claim:${warId}`).setStyle(ButtonStyle.Success).setLabel('Claim Ticket'),
    new ButtonBuilder().setCustomId(`war:confirm:dodge:${warId}`).setStyle(ButtonStyle.Danger).setLabel('Mark Dodge'),
    new ButtonBuilder().setCustomId(`war:closeTicket:${warId}`).setStyle(ButtonStyle.Secondary).setLabel('Close + Transcript')
  );
}

/**
 * Accept the war (only leaders/co-leaders of the opponent guild)
 * CustomId: war:confirm:accept:<warId>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('war:confirm:accept skipped (expired)', { age });
      return;
    }

    await safeDeferEphemeral(interaction);
    if (!interaction.deferred) return; // Defer failed, likely expired

    const [, , , warId] = interaction.customId.split(':');
    const war = await War.findById(warId);
    if (!war) return interaction.editReply({ content: '❌ War not found.' });

    if (war.status !== 'aberta') {
      return interaction.editReply({ content: '⚠️ This war is no longer waiting for confirmation.' });
    }

    // Check if war has already been accepted (prevent spam pings)
    if (war.acceptedAt) {
      return interaction.editReply({
        content: `⚠️ This war has already been accepted by <@${war.acceptedByUserId}> at <t:${Math.floor(war.acceptedAt.getTime() / 1000)}:R>.`
      });
    }

    // Check if user has permission (Leader, Co-leader or Manager role configured on server)
    const cfg = await getOrCreateRoleConfig(interaction.guild.id);
    const leaderId = cfg.leadersRoleId;
    const coLeaderId = cfg.coLeadersRoleId;
    const managersRoleId = cfg.managersRoleId;

    if (!leaderId && !coLeaderId && !managersRoleId) {
      return interaction.editReply({ content: '⚠️ Leader/Co-leader/Manager roles not configured. Ask an administrator to configure them in Configure Roles.' });
    }

    const member = interaction.member;
    const hasRole = Boolean(
      (leaderId && member.roles.cache.has(leaderId)) ||
      (coLeaderId && member.roles.cache.has(coLeaderId)) ||
      (managersRoleId && member.roles.cache.has(managersRoleId))
    );

    if (!hasRole) {
      return interaction.editReply({ content: '❌ Only leaders, co-leaders or managers can accept the war.' });
    }

    // Determine the opponent guild (which must accept)
    const opponentGuildId = getOpponentGuildId(war);
    if (!opponentGuildId) {
      return interaction.editReply({ content: '❌ Incomplete war data. Unable to determine the requesting team. Please recreate the war.' });
    }

    // Restriction: prevent leaders/co-leaders of the requesting guild from accepting on behalf of the opponent
    const requesterGuildId = String(war.requestedByGuildId);
    const { isLeaderOrCoLeader } = require('../../../utils/war/warUtils');
    const isRequesterLeader = await isLeaderOrCoLeader(interaction.user.id, requesterGuildId);
    const isRequesterManager = await Guild.findOne({ _id: requesterGuildId, managers: interaction.user.id });
    if (isRequesterLeader || isRequesterManager) {
      return interaction.editReply({ content: '❌ You cannot accept the war on behalf of your own requesting guild. Only leaders/co-leaders/managers of the opponent guild can accept.' });
    }

    // Confirm that user is leader/co-leader or manager of opponent guild (or has server-level managers role)
    const isOpponentLeader = await isLeaderOrCoLeader(interaction.user.id, opponentGuildId);
    const isOpponentManager = await Guild.findOne({ _id: opponentGuildId, managers: interaction.user.id });
    const hasManagersRole = Boolean(managersRoleId && member.roles.cache.has(managersRoleId));
    if (!(isOpponentLeader || isOpponentManager || hasManagersRole)) {
      return interaction.editReply({ content: '❌ Only leaders, co-leaders or managers of the opponent guild can accept the war.' });
    }

    // Find opponent guild to use name in logs
    const userOpponentGuild = await Guild.findById(opponentGuildId);

    // Mark war as accepted (atomic update to prevent race conditions)
    war.acceptedAt = new Date();
    war.acceptedByUserId = interaction.user.id;
    await war.save();

    // Remove confirmation buttons from message to prevent multiple acceptances
    try { await interaction.message.edit({ components: [] }); } catch (_) { }

    // Find guild docs
    const [guildA, guildB] = await Promise.all([
      Guild.findById(war.guildAId),
      Guild.findById(war.guildBId)
    ]);

    // Send pinned control panel to the war channel
    try {
      const warChannel = war.channelId ? interaction.guild.channels.cache.get(war.channelId) : null;
      if (warChannel && warChannel.type === ChannelType.GuildText) {
        // Check if hoster pings are enabled for this server
        const serverSettings = await getOrCreateServerSettings(interaction.guild.id);
        const hosterPingEnabled = serverSettings.hosterPingEnabled !== false;

        // Mention hosters only once: at the time of acceptance (if enabled)
        const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
        const hosterRoleIds = rolesCfg?.hostersRoleIds || [];
        const hosterMentions = hosterPingEnabled && hosterRoleIds.length
          ? hosterRoleIds.map(id => `<@&${id}>`).join(' ')
          : '';

        try {
          await warChannel.send({
            content: `✅ ${userOpponentGuild.name} accepted the war.${hosterMentions ? ` Calling hosters: ${hosterMentions}` : ''}`,
            allowedMentions: { parse: ['roles'] }
          });
        } catch (_) { }

        const resultContainer = buildWarResultContainer(war, guildA, guildB);
        const controlRow = buildControlRow(war._id);

        await sendAndPin(warChannel, { components: [resultContainer, controlRow], flags: MessageFlags.IsComponentsV2 }, { unpinOld: true });
      }
    } catch (_) { }

    // Disable the original war invitation buttons
    try {
      const disabledButtons = createDisabledWarConfirmationButtons(war._id, 'accepted');
      await interaction.message.edit({ components: [disabledButtons] });
    } catch (error) {
      LoggerService.error('Failed to disable war invitation buttons:', { error: error?.message });
    }

    // Acceptance log
    try {
      await sendLog(
        interaction.guild,
        'War Accepted',
        `War ${war._id}\nAccepted by: <@${interaction.user.id}>\nOpponent team: ${userOpponentGuild?.name || '—'}`
      );
    } catch (_) { }

    return interaction.editReply({ content: '✅ You accepted the war.' });
  } catch (error) {
    LoggerService.error('Error in button war:confirm:accept:', { error: error?.message });
    const msg = { content: '❌ Could not process the acceptance.' };
    if (interaction.deferred || interaction.replied) return interaction.followUp({ ...msg, ephemeral: true });
    return interaction.reply({ ...msg, ephemeral: true });
  }
}

module.exports = { handle };

