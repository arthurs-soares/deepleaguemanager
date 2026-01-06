/**
 * /user command - User management commands
 * Consolidates: profile, fix-guild, reset-ratings
 */
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const userHandlers = require('../../utils/commands/userHandlers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('user')
    .setDescription('User management commands')
    // Profile subcommand
    .addSubcommand(sub =>
      sub.setName('profile')
        .setDescription('Display a user profile')
        .addUserOption(opt =>
          opt.setName('target')
            .setDescription('User to view')
            .setRequired(false)
        )
    )
    // Fix-guild subcommand
    .addSubcommand(sub =>
      sub.setName('fix-guild')
        .setDescription('Diagnose and fix a user\'s guild association')
        .addUserOption(opt =>
          opt.setName('target')
            .setDescription('User to diagnose/fix')
            .setRequired(true)
        )
        .addBooleanOption(opt =>
          opt.setName('apply')
            .setDescription('Apply the fix (otherwise runs in diagnostic mode)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('force_remove_leader')
            .setDescription('Also remove if user is a leader (dangerous)')
            .setRequired(false)
        )
        .addBooleanOption(opt =>
          opt.setName('clear_cooldown')
            .setDescription('Clear guild transition cooldown (default: true)')
            .setRequired(false)
        )
    )
    // Reset-ratings subcommand
    .addSubcommand(sub =>
      sub.setName('reset-ratings')
        .setDescription('Reset all users\' ELO to 800')
        .addBooleanOption(opt =>
          opt.setName('confirm')
            .setDescription('Type true to confirm the global reset')
            .setRequired(true)
        )
    ),

  category: 'User',
  cooldown: 3,

  /**
   * Defer early (before cooldown/DB work) to avoid Unknown interaction (10062).
   * Profile is public; admin/diagnostic subcommands are ephemeral.
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @returns {'public'|'ephemeral'}
   */
  autoDefer(interaction) {
    const sub = interaction.options.getSubcommand(false);
    if (sub === 'profile') return 'public';
    return 'ephemeral';
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'profile':
        return userHandlers.handleProfile(interaction);
      case 'fix-guild':
        return userHandlers.handleFixGuild(interaction);
      case 'reset-ratings':
        return userHandlers.handleResetRatings(interaction);
      default:
        return interaction.reply({
          content: '❌ Unknown subcommand.',
          flags: MessageFlags.Ephemeral
        });
    }
  }
};
