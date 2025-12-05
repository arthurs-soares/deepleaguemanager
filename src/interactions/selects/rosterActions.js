const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const { createErrorEmbed } = require('../../utils/embeds/embedBuilder');
const { isGuildAdmin } = require('../../utils/core/permissions');
const {
  isGuildLeader,
  isGuildCoLeader
} = require('../../utils/guilds/guildMemberManager');
const {
  getGuildById,
  getRegionRosters
} = require('../../utils/roster/rosterManager');

async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildId = parts[1];
    // Decode region (underscores back to spaces)
    const region = parts[2]?.replace(/_/g, ' ');
    if (!guildId || !region) {
      const embed = createErrorEmbed('Invalid', 'Missing data.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const value = interaction.values?.[0];
    if (!value) return interaction.deferUpdate();

    const isAdmin = value.endsWith('_admin');
    const action = isAdmin ? value.replace('_admin', '') : value;
    const source = isAdmin ? 'admin' : 'guild';

    if (!isAdmin) {
      const hasPerms = isGuildLeader(guildDoc, interaction.user.id) ||
        isGuildCoLeader(guildDoc, interaction.user.id);
      if (!hasPerms) {
        const embed = createErrorEmbed(
          'Permission denied',
          'You do not have permission.'
        );
        return interaction.reply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }
    } else {
      const mem = await interaction.guild.members.fetch(interaction.user.id);
      const admin = await isGuildAdmin(mem, interaction.guild.id);
      if (!admin) {
        const embed = createErrorEmbed(
          'Permission denied',
          'Admins only.'
        );
        return interaction.reply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }
    }

    const { mainRoster, subRoster } = getRegionRosters(guildDoc, region);

    // Encode region for safe customId (replace spaces with underscores)
    const safeRegion = region.replace(/ /g, '_');

    if (['add_main', 'add_sub'].includes(action)) {
      const row = new ActionRowBuilder().addComponents(
        new UserSelectMenuBuilder()
          .setCustomId(`roster_user_select:${guildId}:${action}:${source}:${safeRegion}`)
          .setPlaceholder('Select a user')
          .setMinValues(1)
          .setMaxValues(1)
      );
      return interaction.reply({
        content: 'Select a user to invite:',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    if (['remove_main', 'remove_sub'].includes(action)) {
      const list = action === 'remove_main' ? mainRoster : subRoster;
      if (!list || list.length === 0) {
        const embed = createErrorEmbed('Empty', 'No members in this roster.');
        return interaction.reply({
          components: [embed],
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
      }

      const options = list.map(id => ({
        label: `User ${id.slice(-4)}`,
        description: id,
        value: id
      }));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`roster_member_select:${guildId}:${action}:${source}:${safeRegion}`)
          .setPlaceholder('Select member to remove')
          .addOptions(options.slice(0, 25))
      );

      return interaction.reply({
        content: 'Select a member to remove:',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    return interaction.deferUpdate();
  } catch (error) {
    console.error('Error in roster actions:', error);
    const embed = createErrorEmbed('Error', 'Could not process action.');
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [embed],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
