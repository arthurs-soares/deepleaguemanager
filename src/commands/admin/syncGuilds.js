const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { syncRosterForum } = require('../../utils/roster/rosterForumSync');
const { countGuildsByDiscordGuildId } = require('../../utils/guilds/guildRepository');
const LoggerService = require('../../services/LoggerService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('sync')
    .setDescription('Synchronize guild data with Discord (channels/roster posts)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  category: 'Admin',
  cooldown: 10,
  autoDefer: 'ephemeral',

  /**
   * Execute roster synchronization (forum)
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    try {
      // Ensure the forum is configured and update/generate posts
      await syncRosterForum(interaction.guild);

      // Count guilds via repository utility
      const count = await countGuildsByDiscordGuildId(interaction.guild.id);
      return interaction.editReply({
        content: `✅ Synchronization completed. Guilds processed: ${count}.`
      });
    } catch (error) {
      LoggerService.error('Error in /sync command:', { error: error?.message });
      return interaction.editReply({
        content: '❌ An error occurred during synchronization.'
      });
    }
  }
};

