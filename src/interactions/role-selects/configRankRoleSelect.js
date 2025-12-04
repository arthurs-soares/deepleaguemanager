const { MessageFlags } = require('discord.js');
const { setRankRole, RANK_DEFINITIONS } = require('../../utils/misc/rankConfig');

/**
 * Receive selection of 1 role for a rank and save
 * CustomId: config:ranks:roleSelect:<rankKey>
 */
async function handle(interaction) {
  try {
    const [, , , rankKey] = interaction.customId.split(':');
    const roleId = interaction.values?.[0];

    if (!rankKey || !roleId) return interaction.deferUpdate();

    // Validate rank key
    const rankDef = RANK_DEFINITIONS[rankKey];
    if (!rankDef) {
      return interaction.reply({
        content: '❌ Invalid rank.',
        flags: MessageFlags.Ephemeral
      });
    }

    await setRankRole(interaction.guild.id, rankKey, roleId);

    const winsText = rankKey === 'top10' ? 'Top 10 Most Wins' : `${rankDef.wins} Wins`;
    return interaction.reply({
      content: `✅ **${rankDef.name}** (${winsText}) role updated to <@&${roleId}>.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    console.error('Error saving rank role:', error);
    const msg = { content: '❌ Could not save rank role.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
