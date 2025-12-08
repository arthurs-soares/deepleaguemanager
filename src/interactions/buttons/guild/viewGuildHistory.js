const { ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { fetchGuildWars, buildGuildHistoryEmbed } = require('../../../utils/embeds/guildHistoryEmbed');
const { isDatabaseConnected, withDatabase } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');


/**
 * Mostra o histórico de uma guilda (substitui o embed atual)
 * CustomId: viewGuild:history:<guildId>
 */
async function handle(interaction) {
  try {
    const [, , guildId] = interaction.customId.split(':');

    // Acknowledge early and then edit to avoid 3s timeout
    try { await interaction.deferUpdate(); } catch (_) { }

    // If DB is not connected, inform user politely
    const dbUnavailable = !isDatabaseConnected();
    if (dbUnavailable) {
      const msg = { content: '⚠️ Database is initializing. Please try again in a moment.', flags: MessageFlags.Ephemeral };
      try { return interaction.followUp(msg); } catch (_) { return; }
    }

    const guild = await withDatabase(() => Guild.findById(guildId), null);
    if (!guild) return; // nothing to update

    const wars = await fetchGuildWars(interaction.guild.id, guildId, 10);
    const opponentIds = Array.from(new Set(
      wars
        .map(w => String(w.guildAId) === String(guildId) ? String(w.guildBId) : String(w.guildAId))
        .filter(Boolean)
    ));

    const opps = await withDatabase(
      () => Guild.find({ _id: { $in: opponentIds } })
        .select('name')
        .lean(),
      []
    );
    const nameMap = Object.fromEntries(
      opps.map(o => [String(o._id), o.name || 'Unknown guild'])
    );

    const embed = buildGuildHistoryEmbed(guild, wars, nameMap);

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`viewGuild:back:${guildId}`).setStyle(ButtonStyle.Secondary).setLabel('⬅️ Back')
    );

    // After deferring, edit the message instead of calling update
    try { await interaction.message?.edit({ components: [embed, row], flags: MessageFlags.IsComponentsV2 }); } catch (_) { }
    return;
  } catch (error) {
    LoggerService.error('Erro no botão viewGuild:history:', { error: error?.message });
    const msg = { content: '❌ Não foi possível carregar o histórico.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

