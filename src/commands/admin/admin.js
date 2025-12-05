const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { replyEphemeral } = require('../../utils/core/reply');
const { logCommandExecution } = require('../../utils/core/commandLogger');
const War = require('../../models/war/War');
const { listGuilds } = require('../../utils/guilds/list');
const LoggerService = require('../../services/LoggerService');

const adminWar = require('../../utils/commands/adminWar');
const adminWager = require('../../utils/commands/adminWager');
const adminSystem = require('../../utils/commands/adminSystem');
const adminSettings = require('../../utils/commands/adminSettings');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('Administrative commands by domain')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // WAR domain
    .addSubcommandGroup(g => g
      .setName('war')
      .setDescription('War administration')
      .addSubcommand(sc => sc
        .setName('mark-dodge')
        .setDescription('Mark a war as dodge')
        .addStringOption(o => o
          .setName('warid')
          .setDescription('War ID')
          .setAutocomplete(true)
          .setRequired(true))
        .addStringOption(o => o
          .setName('dodger_guild')
          .setDescription('Dodger guild name')
          .setAutocomplete(true)
          .setRequired(true))
        .addBooleanOption(o => o
          .setName('confirm')
          .setDescription('Confirm this destructive action'))
      )
      .addSubcommand(sc => sc
        .setName('undo-dodge')
        .setDescription('Undo a war dodge')
        .addStringOption(o => o
          .setName('warid')
          .setDescription('War ID')
          .setAutocomplete(true)
          .setRequired(true))
        .addBooleanOption(o => o
          .setName('confirm')
          .setDescription('Confirm this destructive action'))
      )
      .addSubcommand(sc => sc
        .setName('revert-result')
        .setDescription('Revert a finalized war result')
        .addStringOption(o => o
          .setName('warid')
          .setDescription('War ID')
          .setAutocomplete(true)
          .setRequired(true))
        .addBooleanOption(o => o
          .setName('confirm')
          .setDescription('Confirm this destructive action'))
      )
    )

    // WAGER domain
    .addSubcommandGroup(g => g
      .setName('wager')
      .setDescription('Wager administration')
      .addSubcommand(sc => sc
        .setName('record')
        .setDescription('Record a wager result between two users')
        .addUserOption(o => o
          .setName('winner')
          .setDescription('Winner')
          .setRequired(true))
        .addUserOption(o => o
          .setName('loser')
          .setDescription('Loser')
          .setRequired(true))
      )
      .addSubcommand(sc => sc
        .setName('set-wins')
        .setDescription('Set wager wins for a user')
        .addUserOption(o => o
          .setName('user')
          .setDescription('Target user')
          .setRequired(true))
        .addIntegerOption(o => o
          .setName('wins')
          .setDescription('Number of wins to set')
          .setRequired(true)
          .setMinValue(0))
      )
    )

    // SYSTEM domain
    .addSubcommandGroup(g => g
      .setName('system')
      .setDescription('System administration')
      .addSubcommand(sc => sc
        .setName('sync')
        .setDescription('Synchronize guild data with Discord')
      )
      .addSubcommand(sc => sc
        .setName('db-status')
        .setDescription('Show current database connection status')
      )
      .addSubcommand(sc => sc
        .setName('db-reset')
        .setDescription('Reset database connection state')
      )
    )

    // SETTINGS domain
    .addSubcommandGroup(g => g
      .setName('settings')
      .setDescription('Server settings administration')
      .addSubcommand(sc => sc
        .setName('hostping')
        .setDescription('Enable/disable hoster pings on war/wager acceptance')
        .addStringOption(o => o
          .setName('status')
          .setDescription('Enable or disable hoster pings')
          .setRequired(true)
          .addChoices(
            { name: 'Enabled', value: 'enabled' },
            { name: 'Disabled', value: 'disabled' }
          ))
      )
    ),

  category: 'Admin',
  cooldown: 3,

  async autocomplete(interaction) {
    try {
      const focused = interaction.options.getFocused(true);
      if (!focused) return;

      if (focused.name === 'guild' || focused.name === 'dodger_guild') {
        const query = String(focused.value || '').trim().toLowerCase();
        const guilds = await listGuilds(interaction.guild.id);
        const choices = guilds
          .filter(g => !query || g.name.toLowerCase().includes(query))
          .slice(0, 25)
          .map(g => ({ name: g.name, value: g.name }));
        return interaction.respond(choices);
      }

      if (focused.name === 'warid') {
        let group = null;
        let sub = null;
        try { group = interaction.options.getSubcommandGroup(); } catch (_) {}
        try { sub = interaction.options.getSubcommand(); } catch (_) {}

        let status = null;
        if (group === 'war') {
          if (sub === 'mark-dodge') status = 'aberta';
          else if (sub === 'undo-dodge') status = 'dodge';
          else if (sub === 'revert-result') status = 'finalizada';
        }

        const query = String(focused.value || '').trim().toLowerCase();
        const find = { };
        if (interaction.guild?.id) find.discordGuildId = interaction.guild.id;
        if (status) find.status = status;

        const wars = await War.find(find).sort({ updatedAt: -1 }).limit(25).lean();
        const choices = wars
          .filter(w => {
            const id = String(w._id || '').toLowerCase();
            return !query || id.includes(query);
          })
          .map(w => ({ name: `${String(w._id)} [${w.status}]`, value: String(w._id) }));
        return interaction.respond(choices);
      }
    } catch (_) {
      try {
        if (!interaction.responded) {
          await interaction.respond([]);
        }
      } catch (_) {}
    }
  },

  async execute(interaction) {
    try {
      const group = interaction.options.getSubcommandGroup();
      const sub = interaction.options.getSubcommand();

      if (group === 'war' && sub === 'mark-dodge') return adminWar.markDodge(interaction);
      if (group === 'war' && sub === 'undo-dodge') return adminWar.undoDodge(interaction);
      if (group === 'war' && sub === 'revert-result') return adminWar.revertResult(interaction);

      if (group === 'wager' && sub === 'record') return adminWager.record(interaction);
      if (group === 'wager' && sub === 'set-wins') return adminWager.setWins(interaction);

      if (group === 'system' && sub === 'sync') return adminSystem.sync(interaction);
      if (group === 'system' && sub === 'db-status') return adminSystem.dbStatus(interaction);
      if (group === 'system' && sub === 'db-reset') return adminSystem.dbReset(interaction);

      if (group === 'settings' && sub === 'hostping') return adminSettings.hostping(interaction);

      return replyEphemeral(interaction, { content: 'Unknown subcommand.' });
    } catch (error) {
      LoggerService.error('Error in /admin:', { error: error?.message });
      await replyEphemeral(interaction, { content: 'Error executing command.' });
    } finally {
      try {
        const extra = interaction._commandLogExtra || {};
        await logCommandExecution(interaction.guild, {
          name: 'admin',
          userId: interaction.user.id,
          status: 'success',
          resultSummary: extra.resultSummary,
          changes: extra.changes
        });
      } catch (_) {}
    }
  }
};

