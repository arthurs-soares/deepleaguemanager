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
  isGuildCoLeader
} = require('../../utils/guilds/guildMemberManager');

async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    const action = parts[2];
    const source = parts[3];
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
    if (!selectedUserId) return interaction.deferUpdate();

    if (!['add_main', 'add_sub'].includes(action)) {
      return interaction.deferUpdate();
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const isAdmin = source === 'admin';
    if (!isAdmin) {
      const hasPerms = isGuildLeader(guildDoc, interaction.user.id) ||
        isGuildCoLeader(guildDoc, interaction.user.id);
      if (!hasPerms) {
        const embed = createErrorEmbed(
          'Permission denied',
          'You do not have permission.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2
        });
      }
    } else {
      const mem = await interaction.guild.members.fetch(interaction.user.id);
      const admin = await isGuildAdmin(mem, interaction.guild.id);
      if (!admin) {
        const embed = createErrorEmbed(
          'Permission denied',
          'Admins only.'
        );
        return interaction.editReply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2
        });
      }
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
    console.error('Error in roster user select:', error);
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
