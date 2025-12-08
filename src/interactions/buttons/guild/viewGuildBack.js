const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { buildGuildDetailDisplayComponents } = require('../../../utils/embeds/guildDetailEmbed');
const LoggerService = require('../../../services/LoggerService');

/**
 * Volta ao embed original de visualização da guilda
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
      new ButtonBuilder().setCustomId(`viewGuild:history:${guildId}`).setStyle(ButtonStyle.Primary).setLabel('📊 History')
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
    LoggerService.error('Erro no botão viewGuild:back:', { error: error?.message });
    const msg = { content: '❌ Não foi possível voltar.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

