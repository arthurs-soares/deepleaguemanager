const { MessageFlags } = require('discord.js');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { sendWagerTicketsPanel } = require('../../utils/wager/wagerTicketsPanel');
const LoggerService = require('../../services/LoggerService');

/**
 * Receive channel selection for wager tickets, save and send the panel
 * CustomId: config:channels:selectWagerTickets
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.wagerTicketsChannelId = channelId;
    await cfg.save();

    try {
      const channel = interaction.guild.channels.cache.get(channelId);
      if (channel) await sendWagerTicketsPanel(channel);
    } catch (err) {
      LoggerService.warn('Failed to send wager tickets panel:', { error: err?.message });
    }

    return interaction.editReply({ content: `✅ Wager tickets channel set to <#${channelId}>.` });
  } catch (error) {
    LoggerService.error('Error saving wager tickets channel:', { error: error?.message });
    const msg = {
      content: '❌ Could not save the wager tickets channel.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

