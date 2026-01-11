/**
 * /ticket command - Ticket management commands
 * Consolidates: close, add-user, remove-user
 */
const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const ticketHandlers = require('../../utils/commands/ticketHandlers');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket management commands')
    // Close subcommand
    .addSubcommand(sub =>
      sub.setName('close')
        .setDescription('Close the current ticket channel')
    )
    // Add-user subcommand
    .addSubcommand(sub =>
      sub.setName('add-user')
        .setDescription('Add a user to the current ticket')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
        )
    )
    // Remove-user subcommand
    .addSubcommand(sub =>
      sub.setName('remove-user')
        .setDescription('Remove a user from the current ticket')
        .addUserOption(opt =>
          opt.setName('user')
            .setDescription('User to remove from the ticket')
            .setRequired(true)
        )
    ),

  category: 'Ticket',
  cooldown: 3,

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'close':
        return ticketHandlers.handleClose(interaction);
      case 'add-user':
        return ticketHandlers.handleAddUser(interaction);
      case 'remove-user':
        return ticketHandlers.handleRemoveUser(interaction);
      default:
        return interaction.reply({
          content: '❌ Unknown subcommand.',
          flags: MessageFlags.Ephemeral
        });
    }
  }
};

