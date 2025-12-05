const { MessageFlags } = require('discord.js');
const { createInfoEmbed } = require('../../../utils/embeds/embedBuilder');

/**
 * Button handler for declining a leadership invitation via DM
 * CustomId: leaderInvite:decline:<guildId>
 */
async function handle(interaction) {
  try {
    // Disable buttons
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) { /* ignore */ }

    const container = createInfoEmbed(
      'Invitation declined',
      'You have declined the leadership invitation.'
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (_) {
    const container = createInfoEmbed(
      'Declined',
      'The invitation was declined.'
    );
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

module.exports = { handle };
