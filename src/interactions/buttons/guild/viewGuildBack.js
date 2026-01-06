const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { buildGuildDetailDisplayComponents } = require('../../../utils/embeds/guildDetailEmbed');
const LoggerService = require('../../../services/LoggerService');

/**
 * Returns to the original guild view
 * CustomId: viewGuild:back:<guildId>
 */
async function handle(interaction) {
  try {
    const [, , guildId] = interaction.customId.split(':');

    // Acknowledge early and then edit to avoid 3s timeout
    try { await interaction.deferUpdate(); } catch (_) { }

    const guild = await Guild.findById(guildId);
    if (!guild) return; // nothing to update

    const container = await buildGuildDetailDisplayComponents(guild, interaction.guild);

    // Reconstrói botões (History)
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`viewGuild:history:${guildId}`).setStyle(ButtonStyle.Primary).setLabel('📊 History'),
      new ButtonBuilder().setCustomId(`viewGuild:rosterHistory:${guildId}`).setStyle(ButtonStyle.Secondary).setLabel('📋 Roster History')
    );

    // Always use Components v2
    try {
      await interaction.message?.edit({
        components: [container, row],
        flags: MessageFlags.IsComponentsV2,
        embeds: null,
        content: null
      });
    } catch (_) { }
    return;
  } catch (error) {
    LoggerService.error('Error in button viewGuild:back:', { error: error?.message });
    const msg = { content: '❌ Could not go back.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

