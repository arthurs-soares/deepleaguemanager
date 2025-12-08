const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { createDisabledWarConfirmationButtons } = require('../../../utils/war/warEmbedBuilder');
const LoggerService = require('../../../services/LoggerService');

/**
 * Open a selector to choose which guild dodged (hosters/mods only)
 * CustomId: war:confirm:dodge:<warId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , , warId] = interaction.customId.split(':');
    const war = await War.findById(warId);
    if (!war) return interaction.editReply({ content: '❌ War not found.' });

    // Permissions: only Moderators/Hosters (configured in /config)
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([...(rolesCfg?.hostersRoleIds || []), ...(rolesCfg?.moderatorsRoleIds || [])]);
    const hasAllowedRole = interaction.member.roles.cache.some(r => allowedRoleIds.has(r.id));
    if (!hasAllowedRole) {
      return interaction.editReply({ content: '❌ Only hosters or moderators can mark a war as dodge.' });
    }

    if (war.status !== 'aberta') {
      return interaction.editReply({ content: '⚠️ This war is no longer waiting for confirmation.' });
    }

    const [guildA, guildB] = await Promise.all([
      Guild.findById(war.guildAId),
      Guild.findById(war.guildBId)
    ]);

    const sourceMessageId = interaction.message?.id;

    const menu = new StringSelectMenuBuilder()
      .setCustomId(`war:dodge:select:${war._id}:${sourceMessageId || '0'}`)
      .setPlaceholder('Select which guild dodged')
      .addOptions([
        { label: guildA?.name || 'Guild A', value: String(war.guildAId) },
        { label: guildB?.name || 'Guild B', value: String(war.guildBId) }
      ]);

    const row = new ActionRowBuilder().addComponents(menu);

    // Disable the original war invitation buttons
    try {
      const disabledButtons = createDisabledWarConfirmationButtons(war._id, 'dodging');
      await interaction.message.edit({ components: [disabledButtons] });
    } catch (error) {
      LoggerService.error('Failed to disable war invitation buttons:', { error: error?.message });
    }

    return interaction.editReply({ content: 'Select which guild dodged this war.', components: [row] });
  } catch (error) {
    LoggerService.error('Error in button war:confirm:dodge:', { error: error?.message });
    const msg = { content: '❌ Could not open the dodge selector.' };
    if (interaction.deferred || interaction.replied) return interaction.followUp({ ...msg, flags: MessageFlags.Ephemeral });
    return interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { handle };

