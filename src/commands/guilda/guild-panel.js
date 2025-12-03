const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { listGuilds, findGuildByName, findGuildsByUser } = require('../../utils/guilds/guildManager');
const { createErrorEmbed, createInfoEmbed } = require('../../utils/embeds/embedBuilder');
const { buildGuildPanelDisplayComponents } = require('../../utils/embeds/guildPanelEmbed');
const { isGuildAdmin } = require('../../utils/core/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('guild')
    .setDescription('Guild-related commands')
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
    ),

  category: 'Guilds',
  cooldown: 5,
  autoDefer: 'ephemeral',

  /**
   * Autocomplete for the name parameter
   * Suggests names of guilds registered in the current server
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
        .slice(0, 25) // Discord limit for autocomplete
        .map(g => ({ name: g.name, value: g.name }));

      await interaction.respond(choices);
    } catch (error) {
      console.error('Error in /guild panel autocomplete:', error);
      try {
        if (!interaction.responded) {
          await interaction.respond([]);
        }
      } catch (_) {}
    }
  },

  /**
   * Execute the /guild panel command
   * @param {ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const isPanel = interaction.options.getSubcommand() === 'panel';
    if (!isPanel) {
      const container = createErrorEmbed('Invalid subcommand', 'Use `/guild panel`.');
      return interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      });
    }

    const requestedName = interaction.options.getString('name');

    try {

      // If name was provided, require Administrator permission (Discord or configured admin roles)
      if (requestedName) {
        const member = await interaction.guild.members.fetch(interaction.user.id);
        const isAdmin = await isGuildAdmin(member, interaction.guild.id);
        if (!isAdmin) {
          const container = createErrorEmbed('Permission denied', 'You need to be a server administrator to view another guild\'s panel.');
          return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }

        const target = await findGuildByName(requestedName, interaction.guild.id);
        if (!target) {
          const container = createInfoEmbed('Guild not found', 'No guild with that name was found on this server.');
          return interaction.editReply({
            components: [container],
            flags: MessageFlags.IsComponentsV2
          });
        }

        const container = await buildGuildPanelDisplayComponents(target, interaction.guild);

        return interaction.editReply({
          components: Array.isArray(container) ? container : [container],
          flags: MessageFlags.IsComponentsV2
        });
      }

      // Without name: search for guilds where the user is leader/co-leader/manager
      const userGuilds = await findGuildsByUser(interaction.user.id, interaction.guild.id);
      if (!userGuilds || userGuilds.length === 0) {
        const container = createInfoEmbed(
          'No associated guild',
          'You are not the leader, co-leader, or manager of any guild on this server.'
        );
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }

      // Display the user's first guild (or we could list if there are several)
      const doc = userGuilds[0];
      const container = await buildGuildPanelDisplayComponents(doc, interaction.guild);

      return interaction.editReply({
        components: Array.isArray(container) ? container : [container],
        flags: MessageFlags.IsComponentsV2
      });

    } catch (error) {
      console.error('Error in /guild panel command:', error);
      const container = createErrorEmbed('Error', 'An error occurred while displaying the guild panel.');
      if (interaction.deferred) {
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }
      if (interaction.replied) {
        return interaction.followUp({
          components: [container],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
        });
      }
      return interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      });
    }
  }
};

