const { MessageFlags } = require('discord.js');
const { setSingle } = require('../../utils/misc/roleConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive selection of 1 role and save
 * CustomId: config:roles:singleSelect:<key>
 */
async function handle(interaction) {
  try {
    const [, , , key] = interaction.customId.split(':');
    const roleId = interaction.values?.[0];
    if (!key || !roleId) return interaction.deferUpdate();

    await setSingle(interaction.guild.id, key, roleId);
    return interaction.reply({ content: '✅ Role updated.', flags: MessageFlags.Ephemeral });
  } catch (error) {
    LoggerService.error('Error saving single role:', { error: error?.message });
    const msg = { content: '❌ Could not save.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

