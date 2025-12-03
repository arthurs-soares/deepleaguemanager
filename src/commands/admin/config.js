const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../config/botConfig');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
const Guild = require('../../models/guild/Guild');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('Display the bot configuration panel')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'Admin',
  cooldown: 5,

  async execute(interaction) {
    try {
      const [channelsCfg, rolesCfg, guildCount] = await Promise.all([
        getOrCreateServerSettings(interaction.guild.id),
        getOrCreateRoleConfig(interaction.guild.id),
        Guild.countDocuments({ discordGuildId: interaction.guild.id })
      ]);

      const container = new ContainerBuilder();
      const primaryColor = typeof colors.primary === 'string'
        ? parseInt(colors.primary.replace('#', ''), 16)
        : colors.primary;
      container.setAccentColor(primaryColor);

      const titleText = new TextDisplayBuilder()
        .setContent('# ⚙️ Bot Configuration');

      const channelsText = new TextDisplayBuilder()
        .setContent(
          '**Channels**\n' +
          `War Tickets: ${channelsCfg.warTicketsChannelId ? `<#${channelsCfg.warTicketsChannelId}>` : '—'}\n` +
          `Wager Tickets: ${channelsCfg.wagerTicketsChannelId ? `<#${channelsCfg.wagerTicketsChannelId}>` : '—'}\n` +
          `General Tickets: ${channelsCfg.generalTicketsChannelId ? `<#${channelsCfg.generalTicketsChannelId}>` : '—'}\n` +
          `War Category: ${channelsCfg.warCategoryId ? `<#${channelsCfg.warCategoryId}>` : '—'}\n` +
          `Wager Category: ${channelsCfg.wagerCategoryId ? `<#${channelsCfg.wagerCategoryId}>` : '—'}\n` +
          `General Tickets Category: ${channelsCfg.generalTicketsCategoryId ? `<#${channelsCfg.generalTicketsCategoryId}>` : '—'}\n` +
          `Logs: ${channelsCfg.logsChannelId ? `<#${channelsCfg.logsChannelId}>` : '—'}\n` +
          `DM Warning: ${channelsCfg.dmWarningChannelId ? `<#${channelsCfg.dmWarningChannelId}>` : '—'}\n` +
          `War Dodge: ${channelsCfg.warDodgeChannelId ? `<#${channelsCfg.warDodgeChannelId}>` : '—'}\n` +
          `Wager Dodge: ${channelsCfg.wagerDodgeChannelId ? `<#${channelsCfg.wagerDodgeChannelId}>` : '—'}\n` +
          `Leaderboard: ${channelsCfg.leaderboardChannelId ? `<#${channelsCfg.leaderboardChannelId}>` : '—'}\n` +
          `Event Points Leaderboard: ${channelsCfg.eventPointsLeaderboardChannelId ? `<#${channelsCfg.eventPointsLeaderboardChannelId}>` : '—'}`
        );

      const rolesText = new TextDisplayBuilder()
        .setContent(
          '**Roles (IDs)**\n' +
          `Leaders: ${rolesCfg.leadersRoleId ? `<@&${rolesCfg.leadersRoleId}>` : '—'}\n` +
          `Co-leaders: ${rolesCfg.coLeadersRoleId ? `<@&${rolesCfg.coLeadersRoleId}>` : '—'}\n` +
          `Managers: ${rolesCfg.managersRoleId ? `<@&${rolesCfg.managersRoleId}>` : '—'}\n` +
          `Moderators: ${rolesCfg.moderatorsRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
          `Hosters: ${rolesCfg.hostersRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
          `Support: ${rolesCfg.supportRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
          `Admin Support: ${rolesCfg.adminSupportRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}`
        );

      const statsText = new TextDisplayBuilder()
        .setContent(`**Statistics**\nRegistered guilds: **${guildCount}**`);

      const footerText = new TextDisplayBuilder()
        .setContent('*Use the buttons below to change the settings.*');

      container.addTextDisplayComponents(
        titleText,
        channelsText,
        rolesText,
        statsText
      );
      container.addSeparatorComponents(new SeparatorBuilder());
      container.addTextDisplayComponents(footerText);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:roles').setStyle(ButtonStyle.Secondary).setLabel('Roles'),
        new ButtonBuilder().setCustomId('config:channels').setStyle(ButtonStyle.Secondary).setLabel('Channels')
      );

      await interaction.reply({
        components: [container, row],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    } catch (error) {
      console.error('Error in /config:', error);
      const msg = { content: '❌ Could not open the panel.', flags: MessageFlags.Ephemeral };
      if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
      return interaction.reply(msg);
    }
  }
};

