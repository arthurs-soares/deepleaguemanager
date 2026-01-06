const {
  MessageFlags,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize
} = require('discord.js');
const {
  createErrorEmbed,
  createWarningEmbed
} = require('../../utils/embeds/embedBuilder');
const {
  getGuildById,
  isUserInRegionRoster
} = require('../../utils/roster/rosterManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../utils/guilds/guildMemberManager');
const LoggerService = require('../../services/LoggerService');
const { safeDeferEphemeral, safeDeferUpdate } = require('../../utils/core/ack');

/** Max age (ms) before interaction is skipped */
const MAX_AGE_MS = 2500;

async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('roster_user_select skipped (expired)', { age });
      return;
    }

    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    const action = parts[2];
    const _source = parts[3]; // Kept for potential future audit use
    // Decode region (underscores back to spaces)
    const region = parts[4]?.replace(/_/g, ' ');

    if (!guildId || !action || !region) {
      const embed = createErrorEmbed('Invalid', 'Missing data.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const selectedUserId = interaction.values?.[0];
    if (!selectedUserId) {
      await safeDeferUpdate(interaction);
      return;
    }

    if (!['add_main', 'add_sub'].includes(action)) {
      await safeDeferUpdate(interaction);
      return;
    }

    await safeDeferEphemeral(interaction);
    if (!interaction.deferred) return; // Defer failed, likely expired

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Check permissions: server admin, guild leader, co-leader, or manager
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isServerAdmin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    const isCoLeader = isGuildCoLeader(guildDoc, interaction.user.id);
    const isManager = isGuildManager(guildDoc, interaction.user.id);

    if (!isServerAdmin && !isLeader && !isCoLeader && !isManager) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only guild leaders, co-leaders, managers, or server admins can manage rosters.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const roster = action === 'add_main' ? 'main' : 'sub';
    const rosterName = roster === 'main' ? 'Main Roster' : 'Sub Roster';

    if (isUserInRegionRoster(guildDoc, selectedUserId, roster, region)) {
      const embed = createWarningEmbed(
        'Already in roster',
        '<@' + selectedUserId + '> is already in ' + rosterName + ' for ' + region + '.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const container = new ContainerBuilder().setAccentColor(0x5865F2);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '## Send Invite\nSend invite to <@' + selectedUserId + '> for ' +
        '**' + guildDoc.name + '** ' + rosterName + ' (' + region + ')?'
      )
    );
    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Encode region for safe customId (replace spaces with underscores)
    const safeRegion = region.replace(/ /g, '_');

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('rosterInvite:sendConfirm:' + guildId + ':' + roster + ':' + selectedUserId + ':yes:' + safeRegion)
        .setLabel('Send Invite')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('rosterInvite:sendConfirm:' + guildId + ':' + roster + ':' + selectedUserId + ':no:' + safeRegion)
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
    );
    container.addActionRowComponents(row);

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in roster user select:', { error: error?.message });
    const embed = createErrorEmbed('Error', 'Could not process selection.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
