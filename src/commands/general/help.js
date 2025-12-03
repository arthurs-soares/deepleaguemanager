const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder,
  SectionBuilder,
  ThumbnailBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../config/botConfig');
const { buildHelpSelectRow } = require('../../utils/misc/helpMenuBuilder');
const { SeparatorSpacingSize } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Display basic bot information and navigation by categories'),

  cooldown: 5,

  /**
   * Execute the help command
   * Shows only basic information and a dropdown to navigate between categories
   * @param {ChatInputCommandInteraction} interaction - Slash command interaction
   */
  async execute(interaction) {
    const { client } = interaction;

    const container = new ContainerBuilder();

    // Convert color to integer if it's a hex string
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    // Header with bot avatar
    const section = new SectionBuilder();
    const headerText = new TextDisplayBuilder()
      .setContent(
        `# ${emojis.info} ${client.user.username}\n` +
        'Bot for **guild** and **war management** with logs, leaderboard and administrative panel.'
      );
    section.addTextDisplayComponents(headerText);

    if (client.user.displayAvatarURL()) {
      const thumbnail = new ThumbnailBuilder()
        .setURL(client.user.displayAvatarURL({ size: 128 }));
      section.setThumbnailAccessory(thumbnail);
    }
    container.addSectionComponents(section);

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Quick navigation hint
    const navText = new TextDisplayBuilder()
      .setContent(
        `${emojis.info} **Quick Navigation**\n` +
        'Use the dropdown menu below to explore help categories.'
      );
    container.addTextDisplayComponents(navText);

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Stats section
    const totalUsers = client.guilds.cache.reduce(
      (acc, guild) => acc + guild.memberCount, 0
    );
    const statsText = new TextDisplayBuilder()
      .setContent(
        `### ${emojis.history} Bot Statistics\n` +
        `${emojis.guild} **Servers:** ${client.guilds.cache.size}\n` +
        `${emojis.members} **Users:** ${totalUsers.toLocaleString()}\n` +
        `${emojis.info} **Commands:** ${client.commands.size}\n` +
        `${emojis.status} **Uptime:** <t:${Math.floor((Date.now() - client.uptime) / 1000)}:R>`
      );
    container.addTextDisplayComponents(statsText);

    container.addSeparatorComponents(
      new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
    );

    // Highlight features
    const featuresText = new TextDisplayBuilder()
      .setContent(
        '### ⭐ Key Features\n' +
        `${emojis.war} **Wars** — Complete ticket system for guild wars\n` +
        `${emojis.leaderboard} **Leaderboards** — Auto-updating guild rankings\n` +
        `🎲 **Wagers** — 1v1 competitive player matches\n` +
        `${emojis.guild} **Guilds** — Full guild management system`
      );
    container.addTextDisplayComponents(featuresText);

    const row = buildHelpSelectRow();

    await interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2
    });
  }
};
