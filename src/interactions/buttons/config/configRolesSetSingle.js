const { RoleSelectMenuBuilder, ActionRowBuilder, MessageFlags } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens a RoleSelect for single role selection categories
 * CustomIds: config:roles:setLeader | config:roles:setCoLeader
 */
async function handle(interaction) {
  try {
    const isLeader = interaction.customId.endsWith(':setLeader');
    const isCoLeader = interaction.customId.endsWith(':setCoLeader');

    let key;
    if (isLeader) key = 'leadersRoleId';
    else if (isCoLeader) key = 'coLeadersRoleId';
    else throw new Error('Unknown role type');

    const menu = new RoleSelectMenuBuilder()
      .setCustomId(`config:roles:singleSelect:${key}`)
      .setPlaceholder('Select a role')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(menu);
    return interaction.reply({ components: [row], flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error opening single role selector:', { error: error?.message });
    const msg = { content: '❌ Could not open the selector.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

