const { PermissionFlagsBits, ChannelType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { colors, emojis } = require('../../../config/botConfig');

// Helpers to keep the handler lean
async function hasClosePermission(member, guildId) {
  const cfg = await getOrCreateRoleConfig(guildId);
  const allowed = new Set([...(cfg?.hostersRoleIds || []), ...(cfg?.moderatorsRoleIds || [])]);
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasRole = member.roles.cache.some(r => allowed.has(r.id));
  return isAdmin || hasRole;
}

async function getWarChannel(guild, warId) {
  const war = await War.findById(warId);
  if (!war || !war.channelId) return { error: '⚠️ War channel not found.' };
  const channel = guild.channels.cache.get(war.channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return { error: '⚠️ This ticket has already been closed or the channel is invalid.' };
  }
  return { war, channel };
}

/**
 * Show confirmation dialog before closing war ticket
 * CustomId: war:closeTicket:<warId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , warId] = interaction.customId.split(':');
    if (!warId) return interaction.editReply({ content: '❌ War ID not provided.' });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await hasClosePermission(member, interaction.guild.id))) {
      return interaction.editReply({ content: '❌ Only hosters, moderators or administrators can close the ticket.' });
    }

    const { error, war, channel } = await getWarChannel(interaction.guild, warId);
    if (error) return interaction.editReply({ content: error });

    // Fetch guild documents for display
    const [guildA, guildB] = await Promise.all([
      Guild.findById(war.guildAId).catch(() => null),
      Guild.findById(war.guildBId).catch(() => null)
    ]);

    const guildAName = guildA?.name || 'Unknown Guild';
    const guildBName = guildB?.name || 'Unknown Guild';

    // Build confirmation container
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning} Confirm War Ticket Closure`);

    const descText = new TextDisplayBuilder()
      .setContent('Are you sure you want to close this war ticket? This action cannot be undone.');

    const detailsText = new TextDisplayBuilder()
      .setContent(
        `**War ID:** ${war._id}\n` +
        `**Guilds:** ${guildAName} vs ${guildBName}\n` +
        `**Scheduled:** <t:${Math.floor(war.scheduledAt.getTime() / 1000)}:F>\n` +
        `**Created:** <t:${Math.floor(war.createdAt.getTime() / 1000)}:R>\n` +
        `**Channel:** ${channel}`
      );

    container.addTextDisplayComponents(titleText, descText, detailsText);

    // Create confirmation buttons
    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`war:closeTicket:confirm:${warId}`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Close'),
      new ButtonBuilder()
        .setCustomId(`war:closeTicket:cancel:${warId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    await interaction.editReply({
      content: '',
      components: [container, actionRow],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
    });

  } catch (error) {
    console.error('Error showing war ticket close confirmation:', error);
    const msg = { content: '❌ Could not show confirmation dialog.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

