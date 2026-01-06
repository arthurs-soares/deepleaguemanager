const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const Guild = require('../../../models/guild/Guild');
const GuildActivityLog = require('../../../models/activity/GuildActivityLog');
const { isDatabaseConnected, withDatabase } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');

/**
 * Shows the roster history of a guild
 * CustomId: viewGuild:rosterHistory:<guildId>
 */
async function handle(interaction) {
  try {
    const [, , guildId] = interaction.customId.split(':');

    try { await interaction.deferUpdate(); } catch (_) { }

    const dbUnavailable = !isDatabaseConnected();
    if (dbUnavailable) {
      const msg = { content: '⚠️ Database is initializing. Please try again in a moment.', flags: MessageFlags.Ephemeral };
      try { return interaction.followUp(msg); } catch (_) { return; }
    }

    const guild = await withDatabase(() => Guild.findById(guildId), null);
    if (!guild) return;

    // Fetch logs
    const logs = await withDatabase(() =>
      GuildActivityLog.find({
        guildId: guildId,
        activityType: { $in: ['join', 'leave'] }
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    []);

    // Build Container
    const container = new ContainerBuilder();
    const guildColor = guild.color
      ? (typeof guild.color === 'string' ? parseInt(guild.color.replace('#', ''), 16) : guild.color)
      : 0x2B2D31;
    container.setAccentColor(guildColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# 📋 Roster History — ${guild.name}`);
    container.addTextDisplayComponents(titleText);

    if (logs.length === 0) {
      const noDataText = new TextDisplayBuilder().setContent('ℹ️ No roster history found recently.');
      container.addTextDisplayComponents(noDataText);
    } else {
      container.addSeparatorComponents(new SeparatorBuilder());

      logs.forEach(log => {
        const date = Math.floor(new Date(log.createdAt).getTime() / 1000);
        const user = log.username ? `**${log.username}**` : `<@${log.userId}>`;
        const actionIcon = log.activityType === 'join' ? '📥' : '📤';
        const actionText = log.activityType === 'join' ? 'Joined' : 'Left';

        const parts = [];
        if (log.roster) parts.push(log.roster === 'main' ? 'Main' : 'Sub');
        if (log.region) parts.push(log.region);
        const details = parts.length > 0 ? `(${parts.join(', ')})` : '';

        // Format: 📥 Joined **User** (Main, Region) • <t:123:R>
        const content = `${actionIcon} ${actionText} ${user} ${details} • <t:${date}:R>`;

        container.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`viewGuild:back:${guildId}`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('⬅️ Back')
    );

    try {
      await interaction.message?.edit({
        components: [container, row],
        flags: MessageFlags.IsComponentsV2
      });
    } catch (_) { }

  } catch (error) {
    LoggerService.error('Error in viewGuild:rosterHistory:', { error: error?.message });
    const msg = { content: '❌ Could not load roster history.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
