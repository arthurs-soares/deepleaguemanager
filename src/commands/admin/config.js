const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../config/botConfig');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
const { getOrCreateRankConfig } = require('../../utils/misc/rankConfig');
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
      const [channelsCfg, rolesCfg, ranksCfg, guildCount] = await Promise.all([
        getOrCreateServerSettings(interaction.guild.id),
        getOrCreateRoleConfig(interaction.guild.id),
        getOrCreateRankConfig(interaction.guild.id),
        Guild.countDocuments({ discordGuildId: interaction.guild.id })
      ]);

      const container = new ContainerBuilder();
      const primaryColor = typeof colors.primary === 'string'
        ? parseInt(colors.primary.replace('#', ''), 16)
        : colors.primary;
      container.setAccentColor(primaryColor);

      const titleText = new TextDisplayBuilder()
        .setContent('# ⚙️ Bot Configuration');

      // Simplified channels summary - count configured vs total
      const channelFields = [
        'warTicketsChannelId', 'wagerTicketsChannelId', 'generalTicketsChannelId',
        'warCategorySAId', 'warCategoryNAEId', 'warCategoryNAWId', 'warCategoryEUId',
        'wagerCategoryId', 'generalTicketsCategoryId', 'logsChannelId',
        'warTranscriptsChannelId', 'wagerTranscriptsChannelId', 'generalTranscriptsChannelId',
        'dmWarningChannelId', 'warDodgeChannelId', 'wagerDodgeChannelId',
        'leaderboardChannelId', 'eventPointsLeaderboardChannelId',
        'rosterForumSAChannelId', 'rosterForumNAChannelId', 'rosterForumEUChannelId'
      ];
      const configuredChannels = channelFields.filter(f => channelsCfg[f]).length;

      // Simplified roles summary
      const singleRoleFields = ['leadersRoleId', 'coLeadersRoleId', 'managersRoleId'];
      const multiRoleFields = ['moderatorsRoleIds', 'hostersRoleIds', 'supportRoleIds', 'adminSupportRoleIds'];
      const configuredSingleRoles = singleRoleFields.filter(f => rolesCfg[f]).length;
      const configuredMultiRoles = multiRoleFields.filter(f => rolesCfg[f]?.length > 0).length;
      const totalConfiguredRoles = configuredSingleRoles + configuredMultiRoles;

      // Simplified ranks summary
      const rankFields = [
        'iron1RoleId', 'iron2RoleId', 'iron3RoleId',
        'silver1RoleId', 'silver2RoleId', 'silver3RoleId',
        'gold1RoleId', 'gold2RoleId', 'gold3RoleId',
        'platinum1RoleId', 'platinum2RoleId', 'platinum3RoleId',
        'diamond1RoleId', 'diamond2RoleId',
        'masterRoleId', 'grandMasterRoleId', 'top10RoleId'
      ];
      const configuredRanks = rankFields.filter(f => ranksCfg[f]).length;

      const summaryText = new TextDisplayBuilder()
        .setContent(
          '**📊 Configuration Summary**\n\n' +
          `📁 **Channels:** ${configuredChannels}/${channelFields.length} configured\n` +
          `👥 **Roles:** ${totalConfiguredRoles}/${singleRoleFields.length + multiRoleFields.length} configured\n` +
          `🏅 **Ranks:** ${configuredRanks}/${rankFields.length} configured\n` +
          `🏰 **Guilds:** ${guildCount} registered`
        );

      const footerText = new TextDisplayBuilder()
        .setContent('*Use the buttons below to configure each section.*');

      container.addTextDisplayComponents(titleText);
      container.addSeparatorComponents(new SeparatorBuilder());
      container.addTextDisplayComponents(summaryText);
      container.addSeparatorComponents(new SeparatorBuilder());
      container.addTextDisplayComponents(footerText);

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('config:roles').setStyle(ButtonStyle.Secondary).setLabel('Roles').setEmoji('👥'),
        new ButtonBuilder().setCustomId('config:channels').setStyle(ButtonStyle.Secondary).setLabel('Channels').setEmoji('📁'),
        new ButtonBuilder().setCustomId('config:ranks').setStyle(ButtonStyle.Secondary).setLabel('Ranks').setEmoji('🏅')
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

