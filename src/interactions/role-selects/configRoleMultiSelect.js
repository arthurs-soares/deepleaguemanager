const { MessageFlags } = require('discord.js');
const { setMulti } = require('../../utils/misc/roleConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive multiple role selection and save
 * CustomId: config:roles:multiSelect:<key>
 */
async function handle(interaction) {
  try {
    const [, , , key] = interaction.customId.split(':');
    const roleIds = interaction.values || [];
    if (!key || !roleIds.length) return interaction.deferUpdate();

    await setMulti(interaction.guild.id, key, roleIds);
    return interaction.reply({ content: '✅ Roles updated.', flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error saving multiple roles:', { error: error?.message });
    const msg = { content: '❌ Could not save.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

