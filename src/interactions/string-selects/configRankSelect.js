const { RoleSelectMenuBuilder, ActionRowBuilder } = require('discord.js');
const { RANK_DEFINITIONS } = require('../../../utils/misc/rankConfig');

/**
 * Handle rank configuration dropdown selection
 * CustomId: config:ranks:select
 */
async function handle(interaction) {
  try {
    const selectedValue = interaction.values[0];

    // Validate that the selected rank exists
    const rankDef = RANK_DEFINITIONS[selectedValue];
    if (!rankDef) {
      return interaction.reply({
        content: '❌ Invalid rank selection.',
        ephemeral: true
      });
    }

    // Create role selector for the selected rank
    const winsText = selectedValue === 'top10' ? 'Top 10' : `${rankDef.wins} Wins`;
    const roleSelect = new RoleSelectMenuBuilder()
      .setCustomId(`config:ranks:roleSelect:${selectedValue}`)
      .setPlaceholder(`Select role for ${rankDef.name} (${winsText})`)
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    return interaction.reply({
      content: `${rankDef.emoji} Select the role for **${rankDef.name}** (requires ${winsText}):`,
      components: [row],
      ephemeral: true
    });

  } catch (error) {
    console.error('Error handling rank configuration selection:', error);
    const msg = { content: '❌ Could not process selection.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
