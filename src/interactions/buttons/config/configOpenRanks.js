const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const { getOrCreateRankConfig, buildRanksDisplayText } = require('../../../utils/misc/rankConfig');

/**
 * Opens Ranks panel
 * CustomId: config:ranks
 */
async function handle(interaction) {
  try {
    const cfg = await getOrCreateRankConfig(interaction.guild.id);

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# 🏅 Configure Ranks');

    const descText = new TextDisplayBuilder()
      .setContent('Select a rank from the dropdown menu below to configure its role.\nRanks are awarded based on the number of wins.');

    const ranksText = new TextDisplayBuilder()
      .setContent(buildRanksDisplayText(cfg));

    container.addTextDisplayComponents(titleText, descText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(ranksText);

    // Create dropdown menu for rank configuration
    const rankSelect = new StringSelectMenuBuilder()
      .setCustomId('config:ranks:select')
      .setPlaceholder('Select a rank to configure')
      .addOptions([
        // 🔩 Iron Ranks
        new StringSelectMenuOptionBuilder()
          .setLabel('Iron 1 (2 Wins)')
          .setDescription('Configure Iron 1 rank role')
          .setValue('iron1')
          .setEmoji('🔩'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Iron 2 (4 Wins)')
          .setDescription('Configure Iron 2 rank role')
          .setValue('iron2')
          .setEmoji('🔩'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Iron 3 (6 Wins)')
          .setDescription('Configure Iron 3 rank role')
          .setValue('iron3')
          .setEmoji('🔩'),

        // 🥈 Silver Ranks
        new StringSelectMenuOptionBuilder()
          .setLabel('Silver 1 (8 Wins)')
          .setDescription('Configure Silver 1 rank role')
          .setValue('silver1')
          .setEmoji('🥈'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Silver 2 (10 Wins)')
          .setDescription('Configure Silver 2 rank role')
          .setValue('silver2')
          .setEmoji('🥈'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Silver 3 (12 Wins)')
          .setDescription('Configure Silver 3 rank role')
          .setValue('silver3')
          .setEmoji('🥈'),

        // 🥇 Gold Ranks
        new StringSelectMenuOptionBuilder()
          .setLabel('Gold 1 (14 Wins)')
          .setDescription('Configure Gold 1 rank role')
          .setValue('gold1')
          .setEmoji('🥇'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Gold 2 (16 Wins)')
          .setDescription('Configure Gold 2 rank role')
          .setValue('gold2')
          .setEmoji('🥇'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Gold 3 (18 Wins)')
          .setDescription('Configure Gold 3 rank role')
          .setValue('gold3')
          .setEmoji('🥇'),

        // 💎 Platinum Ranks
        new StringSelectMenuOptionBuilder()
          .setLabel('Platinum 1 (20 Wins)')
          .setDescription('Configure Platinum 1 rank role')
          .setValue('platinum1')
          .setEmoji('💎'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Platinum 2 (22 Wins)')
          .setDescription('Configure Platinum 2 rank role')
          .setValue('platinum2')
          .setEmoji('💎'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Platinum 3 (24 Wins)')
          .setDescription('Configure Platinum 3 rank role')
          .setValue('platinum3')
          .setEmoji('💎'),

        // 💠 Diamond Ranks
        new StringSelectMenuOptionBuilder()
          .setLabel('Diamond 1 (26 Wins)')
          .setDescription('Configure Diamond 1 rank role')
          .setValue('diamond1')
          .setEmoji('💠'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Diamond 2 (28 Wins)')
          .setDescription('Configure Diamond 2 rank role')
          .setValue('diamond2')
          .setEmoji('💠'),

        // 👑 High Elo Ranks
        new StringSelectMenuOptionBuilder()
          .setLabel('Master (30 Wins)')
          .setDescription('Configure Master rank role')
          .setValue('master')
          .setEmoji('👑'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Grand Master (35 Wins)')
          .setDescription('Configure Grand Master rank role')
          .setValue('grandMaster')
          .setEmoji('🏆'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Top 10')
          .setDescription('Configure Top 10 rank role (Top 10 Most Wins)')
          .setValue('top10')
          .setEmoji('⭐')
      ]);

    const row = new ActionRowBuilder().addComponents(rankSelect);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('Error opening ranks panel:', error);
    const msg = { content: '❌ Could not open the ranks panel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
