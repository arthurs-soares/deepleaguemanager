const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags
} = require('discord.js');
const {
  buildWagerLeaderboardEmbed
} = require('../../utils/wager/wagerLeaderboard');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('wagerlb')
    .setDescription('Show the Wager leaderboard (server members)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'Admin',
  cooldown: 5,

  async execute(interaction) {
    const container = await buildWagerLeaderboardEmbed(interaction.guild);
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
};

