const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { createDisabledWarConfirmationButtons } = require('../../../utils/war/warEmbedBuilder');
const { safeDeferEphemeral, safeEditReply, isBenignError } = require('../../../utils/core/ack');
const LoggerService = require('../../../services/LoggerService');

/**
 * Open a selector to choose which guild dodged (hosters/mods only)
 * CustomId: war:confirm:dodge:<warId>
 */
async function handle(interaction) {
  try {
    const deferred = await safeDeferEphemeral(interaction);
    if (!deferred) return;

    const [, , , warId] = interaction.customId.split(':');
    const war = await War.findById(warId);
    if (!war) return safeEditReply(interaction, { content: '❌ War not found.' });

    // Permissions: only Moderators/Hosters (configured in /config)
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([...(rolesCfg?.hostersRoleIds || []), ...(rolesCfg?.moderatorsRoleIds || [])]);
    const hasAllowedRole = interaction.member.roles.cache.some(r => allowedRoleIds.has(r.id));
    if (!hasAllowedRole) {
      return safeEditReply(interaction, { content: '❌ Only hosters or moderators can mark a war as dodge.' });
    }

    if (war.status !== 'aberta') {
      return safeEditReply(interaction, { content: '⚠️ This war is no longer waiting for confirmation.' });
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

    return safeEditReply(interaction, { content: 'Select which guild dodged this war.', components: [row] });
  } catch (error) {
    // Skip logging for benign interaction errors
    if (!isBenignError(error)) {
      LoggerService.error('Error in button war:confirm:dodge:', { error: error?.message });
    }
    const msg = { content: '❌ Could not open the dodge selector.' };
    if (interaction.deferred || interaction.replied) {
      return safeEditReply(interaction, msg);
    }
    // Fallback - interaction might be invalid
  }
}

module.exports = { handle };

