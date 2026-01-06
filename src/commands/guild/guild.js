const {
  SlashCommandBuilder,
  MessageFlags
} = require('discord.js');
const { listGuilds } = require('../../utils/guilds/guildManager');
const { createErrorEmbed } = require('../../utils/embeds/embedBuilder');
const guildHandlers = require('../../utils/commands/guildHandlers');
const LoggerService = require('../../services/LoggerService');
const { safeAutocompleteRespond } = require('../../utils/core/ack');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Guild management commands')
    // Panel subcommand
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Display a guild panel')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Guild name (requires admin to view another)')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )
    // Register subcommand
    .addSubcommand(sub =>
      sub
        .setName('register')
        .setDescription('Register a new guild')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Guild name')
            .setRequired(true)
            .setMaxLength(100)
        )
        .addUserOption(opt =>
          opt
            .setName('leader')
            .setDescription('Select the guild leader')
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('region')
            .setDescription('Guild region')
            .setRequired(true)
            .addChoices(
              { name: 'Europe', value: 'Europe' },
              { name: 'South America', value: 'South America' },
              { name: 'NA East', value: 'NA East' },
              { name: 'NA West', value: 'NA West' }
            )
        )
        .addStringOption(opt =>
          opt
            .setName('extra_regions')
            .setDescription('Additional regions (comma-separated: "NA West, Europe")')
            .setRequired(false)
            .setMaxLength(100)
        )
    )
    // Delete subcommand
    .addSubcommand(sub =>
      sub
        .setName('delete')
        .setDescription('Delete a guild from the database')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Name of the guild to delete')
            .setAutocomplete(true)
            .setRequired(true)
        )
    )
    // View subcommand
    .addSubcommand(sub =>
      sub
        .setName('view')
        .setDescription('View guilds or details of a guild')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Guild name to view details')
            .setAutocomplete(true)
            .setRequired(false)
        )
    )
    // Set-score subcommand
    .addSubcommand(sub =>
      sub
        .setName('set-score')
        .setDescription('Set W/L score for a guild')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Guild name')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('region')
            .setDescription('Region to set score for')
            .setRequired(true)
            .addChoices(
              { name: 'Europe', value: 'Europe' },
              { name: 'South America', value: 'South America' },
              { name: 'NA East', value: 'NA East' },
              { name: 'NA West', value: 'NA West' }
            )
        )
        .addIntegerOption(opt =>
          opt
            .setName('wins')
            .setDescription('Wins')
            .setRequired(true)
        )
        .addIntegerOption(opt =>
          opt
            .setName('losses')
            .setDescription('Losses')
            .setRequired(true)
        )
    )
    // Add-region subcommand
    .addSubcommand(sub =>
      sub
        .setName('add-region')
        .setDescription('Register guild in a new region')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Guild name')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('region')
            .setDescription('Region to add')
            .setRequired(true)
            .addChoices(
              { name: 'Europe', value: 'Europe' },
              { name: 'South America', value: 'South America' },
              { name: 'NA East', value: 'NA East' },
              { name: 'NA West', value: 'NA West' }
            )
        )
    )
    // Remove-region subcommand
    .addSubcommand(sub =>
      sub
        .setName('remove-region')
        .setDescription('Remove guild from a region')
        .addStringOption(opt =>
          opt
            .setName('name')
            .setDescription('Guild name')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(opt =>
          opt
            .setName('region')
            .setDescription('Region to remove')
            .setRequired(true)
            .addChoices(
              { name: 'Europe', value: 'Europe' },
              { name: 'South America', value: 'South America' },
              { name: 'NA East', value: 'NA East' },
              { name: 'NA West', value: 'NA West' }
            )
        )
    ),

  category: 'Guilds',
  cooldown: 5,

  /**
   * Autocomplete for name parameter
   * @param {AutocompleteInteraction} interaction
   */
  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      if (focused.name !== 'name') return;

      const query = String(focused.value || '').trim();
      const guilds = await listGuilds(interaction.guild.id);
      const choices = guilds
        .filter(g => !query || g.name.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 25)
        .map(g => ({ name: g.name, value: g.name }));

      await safeAutocompleteRespond(interaction, choices);
    } catch (error) {
      LoggerService.error('Error in /guild autocomplete:', { error: error.message });
      await safeAutocompleteRespond(interaction, []);
    }
  },

  /**
   * Execute the /guild command
   * @param {ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    switch (subcommand) {
      case 'panel':
        return guildHandlers.handlePanel(interaction);
      case 'register':
        return guildHandlers.handleRegister(interaction);
      case 'delete':
        return guildHandlers.handleDelete(interaction);
      case 'view':
        return guildHandlers.handleView(interaction);
      case 'set-score':
        return guildHandlers.handleSetScore(interaction);
      case 'add-region':
        return guildHandlers.handleAddRegion(interaction);
      case 'remove-region':
        return guildHandlers.handleRemoveRegion(interaction);
      default: {
        const container = createErrorEmbed('Invalid', 'Unknown subcommand.');
        return interaction.reply({
          components: [container],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
        });
      }
    }
  }
};

