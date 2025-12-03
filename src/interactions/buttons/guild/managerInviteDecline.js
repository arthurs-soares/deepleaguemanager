const { MessageFlags } = require('discord.js');
const {
  createInfoEmbed
} = require('../../../utils/embeds/embedBuilder');

/**
 * Button handler for declining a manager invitation via DM
 * CustomId: managerInvite:decline:<guildId>
 */
async function handle(interaction) {
  try {
    // Disable buttons
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) { /* ignore */ }

    const container = createInfoEmbed(
      'Invitation declined',
      'You have declined the manager invitation.'
    );

    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
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
