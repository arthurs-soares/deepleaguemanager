const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const { createErrorEmbed } = require('../../../utils/embeds/embedBuilder');
const Guild = require('../../../models/guild/Guild');
const { isGuildAdmin } = require('../../../utils/core/permissions');
const {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager
} = require('../../../utils/guilds/guildMemberManager');

/**
 * "Edit Roster" button handler
 * Expected CustomId: guild_panel:edit_roster:<guildId>
 * First shows region selector, then roster actions.
 * @param {ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    if (!guildId) {
      const embed = createErrorEmbed('Invalid data', 'GuildId not provided.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Fetch guild to get available regions
    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Permission check: server admin, leader, co-leader, or manager
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isServerAdmin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    const isCoLeader = isGuildCoLeader(guildDoc, interaction.user.id);
    const isMgr = isGuildManager(guildDoc, interaction.user.id);

    if (!isServerAdmin && !isLeader && !isCoLeader && !isMgr) {
      const embed = createErrorEmbed(
        'Permission denied',
        'Only guild leaders, co-leaders, managers, or server admins can edit rosters.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const regions = Array.isArray(guildDoc.regions) ? guildDoc.regions : [];
    if (regions.length === 0) {
      const embed = createErrorEmbed(
        'No regions',
        'Guild has no registered regions.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // If only one region, skip region selection
    if (regions.length === 1) {
      const region = regions[0].region;
      return showRosterActions(interaction, guildId, region);
    }

    // Multiple regions - show region selector first
    const regionOptions = regions.map(r => ({
      label: r.region,
      description: `Manage rosters for ${r.region}`,
      value: r.region
    }));

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`roster_region_select:${guildId}`)
      .setPlaceholder('Select a region to manage rosters')
      .addOptions(regionOptions);

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('Error in Edit Roster button:', error);
    const container = createErrorEmbed('Error', 'Could not open roster menu.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

/**
 * Show roster action menu for a specific region
 * @param {ButtonInteraction} interaction
 * @param {string} guildId
 * @param {string} region
 */
async function showRosterActions(interaction, guildId, region) {
  // Encode region for safe customId (replace spaces with underscores)
  const safeRegion = region.replace(/ /g, '_');

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`roster_actions:${guildId}:${safeRegion}`)
    .setPlaceholder(`Manage rosters for ${region}`)
    .addOptions([
      {
        label: 'Add Main Roster',
        description: `Add user to main roster for ${region}`,
        value: 'add_main'
      },
      {
        label: 'Add Sub Roster',
        description: `Add user to sub roster for ${region}`,
        value: 'add_sub'
      },
      {
        label: 'Remove Main Roster',
        description: `Remove user from main roster for ${region}`,
        value: 'remove_main'
      },
      {
        label: 'Remove Sub Roster',
        description: `Remove user from sub roster for ${region}`,
        value: 'remove_sub'
      },
      {
        label: 'Remove Co-leader (not in roster)',
        description: 'Demote co-leader who is not on current rosters',
        value: 'remove_co_leader_external'
      },
    ]);

  const row = new ActionRowBuilder().addComponents(menu);
  return interaction.reply({
    components: [row],
    flags: MessageFlags.Ephemeral
  });
}

module.exports = { handle, showRosterActions };
