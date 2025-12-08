const { RoleSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { replyEphemeral } = require('../../../utils/core/reply');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens a RoleSelect for categories with multiple selections
 * CustomIds: config:roles:setModerators | config:roles:setHosters | config:roles:setSupport
 */
async function handle(interaction) {
  try {
    const isHosters = interaction.customId.endsWith(':setHosters');
    const isSupport = interaction.customId.endsWith(':setSupport');

    let key = 'moderatorsRoleIds';
    if (isHosters) key = 'hostersRoleIds';
    if (isSupport) key = 'supportRoleIds';

    const menu = new RoleSelectMenuBuilder()
      .setCustomId(`config:roles:multiSelect:${key}`)
      .setPlaceholder('Select roles (1..25)')
      .setMinValues(1)
      .setMaxValues(25);

    const row = new ActionRowBuilder().addComponents(menu);
    return replyEphemeral(interaction, { components: [row] });
  } catch (error) {
    LoggerService.error('Error opening multiple roles selector:', { error: error?.message });
    return replyEphemeral(interaction, { content: '❌ Could not open the selector.' });
  }
}

module.exports = { handle };

