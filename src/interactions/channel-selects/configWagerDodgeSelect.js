const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Save Wager Dodge Channel selection
 * CustomId: config:channels:selectWagerDodge
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) {
      return interaction.editReply({ content: 'Action cancelled.' });
    }

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.wagerDodgeChannelId = channelId;
    await cfg.save();

    return interaction.editReply({
      content: `✅ Wager Dodge notifications channel set to <#${channelId}>.`
    });
  } catch (error) {
    LoggerService.error('Error saving Wager Dodge channel:', { error });
    const msg = {
      content: '❌ Could not save the Wager Dodge channel.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
