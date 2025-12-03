const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');

/**
 * Opens Channels panel
 * CustomId: config:channels
 */
async function handle(interaction) {
  try {
    const cfg = await getOrCreateServerSettings(interaction.guild.id);

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# ⚙️ Configure Channels');

    const descText = new TextDisplayBuilder()
      .setContent('Select a channel type from the dropdown menu below to configure it.');

    const channelsText = new TextDisplayBuilder()
      .setContent(
        `**War Tickets Channel:** ${cfg.warTicketsChannelId ? `<#${cfg.warTicketsChannelId}>` : '—'}\n` +
        `**Wager Tickets Channel:** ${cfg.wagerTicketsChannelId ? `<#${cfg.wagerTicketsChannelId}>` : '—'}\n` +
        `**General Tickets Channel:** ${cfg.generalTicketsChannelId ? `<#${cfg.generalTicketsChannelId}>` : '—'}\n` +
        `**War Category:** ${cfg.warCategoryId ? `<#${cfg.warCategoryId}>` : '—'}\n` +
        `**Wager Category:** ${cfg.wagerCategoryId ? `<#${cfg.wagerCategoryId}>` : '—'}\n` +
        `**General Tickets Category:** ${cfg.generalTicketsCategoryId ? `<#${cfg.generalTicketsCategoryId}>` : '—'}\n` +
        `**Logs Channel:** ${cfg.logsChannelId ? `<#${cfg.logsChannelId}>` : '—'}\n` +
        `**DM Warning Channel:** ${cfg.dmWarningChannelId ? `<#${cfg.dmWarningChannelId}>` : '—'}\n` +
        `**War Dodge Channel:** ${cfg.warDodgeChannelId ? `<#${cfg.warDodgeChannelId}>` : '—'}\n` +
        `**Wager Dodge Channel:** ${cfg.wagerDodgeChannelId ? `<#${cfg.wagerDodgeChannelId}>` : '—'}\n` +
        `**War Logs Channel:** ${cfg.warLogsChannelId ? `<#${cfg.warLogsChannelId}>` : '—'}\n` +
        `**Guild Rosters Forum:** ${cfg.rosterForumChannelId ? `<#${cfg.rosterForumChannelId}>` : '—'}\n` +
        `**Guild Leaderboard Channel:** ${cfg.leaderboardChannelId ? `<#${cfg.leaderboardChannelId}>` : '—'}\n` +
        `**Wager Leaderboard Channel:** ${cfg.wagerLeaderboardChannelId ? `<#${cfg.wagerLeaderboardChannelId}>` : '—'}\n` +
        `**Event Points Leaderboard:** ${cfg.eventPointsLeaderboardChannelId ? `<#${cfg.eventPointsLeaderboardChannelId}>` : '—'}`
      );

    container.addTextDisplayComponents(titleText, descText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(channelsText);

    // Create dropdown menu for channel configuration
    const channelSelect = new StringSelectMenuBuilder()
      .setCustomId('config:channels:select')
      .setPlaceholder('Select a channel type to configure')
      .addOptions([
        // 🎫 Ticket Channels
        new StringSelectMenuOptionBuilder()
          .setLabel('War Tickets Channel')
          .setDescription('Channel for war ticket panels')
          .setValue('warTickets')
          .setEmoji('🎫'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Wager Tickets Channel')
          .setDescription('Channel for wager ticket panels')
          .setValue('wagerTickets')
          .setEmoji('🎫'),
        new StringSelectMenuOptionBuilder()
          .setLabel('General Tickets Channel')
          .setDescription('Channel for general ticket panels')
          .setValue('generalTickets')
          .setEmoji('🎫'),

        // 📁 Categories
        new StringSelectMenuOptionBuilder()
          .setLabel('War Category')
          .setDescription('Category for war channels')
          .setValue('warCategory')
          .setEmoji('📁'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Wager Category')
          .setDescription('Category for wager channels')
          .setValue('wagerCategory')
          .setEmoji('📁'),
        new StringSelectMenuOptionBuilder()
          .setLabel('General Tickets Category')
          .setDescription('Category for general ticket channels')
          .setValue('generalTicketsCategory')
          .setEmoji('📁'),

        // 🏆 Leaderboards
        new StringSelectMenuOptionBuilder()
          .setLabel('Guild Leaderboard Channel')
          .setDescription('Channel for guild leaderboard auto-updates')
          .setValue('leaderboard')
          .setEmoji('🏆'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Wager Leaderboard Channel')
          .setDescription('Channel for wager leaderboard auto-updates')
          .setValue('wagerLeaderboard')
          .setEmoji('🎲'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Event Points Leaderboard')
          .setDescription('Channel for event points leaderboard')
          .setValue('eventPointsLeaderboard')
          .setEmoji('⭐'),

        // 📢 Notifications
        new StringSelectMenuOptionBuilder()
          .setLabel('Logs Channel')
          .setDescription('Channel for bot logs and notifications')
          .setValue('logs')
          .setEmoji('📢'),
        new StringSelectMenuOptionBuilder()
          .setLabel('DM Warning Channel')
          .setDescription('Channel for DM warning notifications')
          .setValue('dmWarning')
          .setEmoji('📢'),
        new StringSelectMenuOptionBuilder()
          .setLabel('War Dodge Channel')
          .setDescription('Channel for war dodge notifications')
          .setValue('warDodge')
          .setEmoji('📢'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Wager Dodge Channel')
          .setDescription('Channel for wager dodge notifications')
          .setValue('wagerDodge')
          .setEmoji('🎲'),
        new StringSelectMenuOptionBuilder()
          .setLabel('War Logs Channel')
          .setDescription('Channel for war log messages')
          .setValue('warLogs')
          .setEmoji('⚔️'),

        // 📋 Other
        new StringSelectMenuOptionBuilder()
          .setLabel('Guild Rosters Forum')
          .setDescription('Forum channel for guild roster posts')
          .setValue('rosterForum')
          .setEmoji('📋')
      ]);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('Error opening channels panel:', error);
    const msg = { content: '❌ Could not open the channels panel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

