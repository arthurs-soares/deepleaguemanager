const { RoleSelectMenuBuilder, ActionRowBuilder } = require('discord.js');

/**
 * Handle role configuration dropdown selection
 * CustomId: config:roles:select
 */
async function handle(interaction) {
  try {
    const selectedValue = interaction.values[0];

    // Map selection values to their corresponding role selectors
    const roleConfigs = {
      leader: {
        customId: 'config:roles:singleSelect:leadersRoleId',
        placeholder: 'Select the leaders role',
        minValues: 1,
        maxValues: 1
      },
      coLeader: {
        customId: 'config:roles:singleSelect:coLeadersRoleId',
        placeholder: 'Select the co-leaders role',
        minValues: 1,
        maxValues: 1
      },
      manager: {
        customId: 'config:roles:singleSelect:managersRoleId',
        placeholder: 'Select the managers role',
        minValues: 1,
        maxValues: 1
      },
      moderators: {
        customId: 'config:roles:multiSelect:moderatorsRoleIds',
        placeholder: 'Select moderator roles (1-25)',
        minValues: 1,
        maxValues: 25
      },
      hosters: {
        customId: 'config:roles:multiSelect:hostersRoleIds',
        placeholder: 'Select hoster roles (1-25)',
        minValues: 1,
        maxValues: 25
      },
      support: {
        customId: 'config:roles:multiSelect:supportRoleIds',
        placeholder: 'Select support roles (1-25)',
        minValues: 1,
        maxValues: 25
      },
      adminSupport: {
        customId: 'config:roles:multiSelect:adminSupportRoleIds',
        placeholder: 'Select admin support roles (1-25)',
        minValues: 1,
        maxValues: 25
      }
    };

    const config = roleConfigs[selectedValue];
    if (!config) {
      return interaction.reply({
        content: '❌ Invalid selection.',
        ephemeral: true
      });
    }

    // Create role selector based on the configuration
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId(config.customId)
      .setPlaceholder(config.placeholder)
      .setMinValues(config.minValues)
      .setMaxValues(config.maxValues);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    return interaction.reply({
      components: [row],
      ephemeral: true
    });

  } catch (error) {
    console.error('Error handling role configuration selection:', error);
    const msg = { content: '❌ Could not process selection.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
