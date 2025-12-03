const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { replyEphemeral } = require('../../utils/core/reply');
const { logCommandExecution } = require('../../utils/core/commandLogger');
const War = require('../../models/war/War');
const { listGuilds } = require('../../utils/guilds/list');
const LoggerService = require('../../services/LoggerService');

const adminWar = require('../../utils/commands/adminWar');
const adminWager = require('../../utils/commands/adminWager');


/**
 * Build info container for responses
 * @param {string[]} lines - Content lines
 * @returns {ContainerBuilder}
 */
function _buildInfoContainer(lines) {
  const container = new ContainerBuilder();
  const content = (lines || [])
    .filter(line => typeof line === 'string' && line.trim().length > 0)
    .join('\n');
  if (content.trim().length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );
  }
  return container;
}

async function warMarkDodge(interaction) {
  return adminWar.markDodge(interaction);
}

async function warUndoDodge(interaction) {
  return adminWar.undoDodge(interaction);
}

async function warRevertResult(interaction) {
  return adminWar.revertResult(interaction);
}

async function wagerRecord(interaction) {
  return adminWager.record(interaction);
}

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

      if (group === 'war' && sub === 'mark-dodge') return warMarkDodge(interaction);
      if (group === 'war' && sub === 'undo-dodge') return warUndoDodge(interaction);
      if (group === 'war' && sub === 'revert-result') {
        return warRevertResult(interaction);
      }

      if (group === 'wager' && sub === 'record') return wagerRecord(interaction);

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

