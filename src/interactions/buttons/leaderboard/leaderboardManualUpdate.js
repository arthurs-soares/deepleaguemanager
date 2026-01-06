const { isGuildAdmin } = require('../../../utils/core/permissions');
const { MessageFlags } = require('discord.js');
const { upsertLeaderboardMessage } = require('../../../utils/user/leaderboard');
const { upsertWagerLeaderboardMessage } = require('../../../utils/wager/wagerLeaderboard');
const { upsertEventPointsLeaderboard } = require('../../../utils/leaderboard/eventPointsLeaderboard');
const LoggerService = require('../../../services/LoggerService');

module.exports = {
  name: 'leaderboardManualUpdate',
  customId: 'leaderboard:update', // Prefix for leaderboard update buttons

  /**
     * Handle the manual update button click
     * @param {import('discord.js').ButtonInteraction} interaction
     */
  async execute(interaction) {
    if (!interaction.guild) return;

    // Check permissions
    const authorized = await isGuildAdmin(interaction.member, interaction.guild.id);
    if (!authorized) {
      return interaction.reply({
        content: '❌ Only users with the configured **Moderator** role can manually update the leaderboard.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [, type] = interaction.customId.split(':');

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      let result;
      switch (type) {
        case 'guild':
          result = await upsertLeaderboardMessage(interaction.guild);
          break;
        case 'wager':
          // upsertWagerLeaderboardMessage returns void, doesn't return result object usually
          // Checking the file content again shows it returns void or promise<void>.
          // Actually upsertWagerLeaderboardMessage logic: catches errors internally.
          await upsertWagerLeaderboardMessage(interaction.guild);
          result = { ok: true };
          break;
        case 'eventpoints':
          result = await upsertEventPointsLeaderboard(interaction.guild);
          break;
        default:
          return interaction.editReply('❌ Unknown leaderboard type.');
      }

      if (result && result.ok === false) {
        return interaction.editReply(`❌ Failed to update leaderboard: ${result.reason || 'Unknown error'}`);
      }

      await interaction.editReply('✅ Leaderboard updated successfully!');
      LoggerService.info(`Leaderboard manually updated by ${interaction.user.tag}`, {
        guildId: interaction.guild.id,
        type
      });

    } catch (error) {
      LoggerService.error('Error in manual leaderboard update:', { error: error.message });
      await interaction.editReply('❌ An error occurred while updating the leaderboard.');
    }
  }
};
