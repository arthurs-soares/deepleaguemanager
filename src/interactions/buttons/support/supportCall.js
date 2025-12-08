const { MessageFlags } = require('discord.js');
const { buildSupportRoleMentions } = require('../../../utils/misc/mentions');
const { logRoleMention } = require('../../../utils/core/roleLogger');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const LoggerService = require('../../../services/LoggerService');

/**
 * Call Support button handler
 * CustomId: support:call
 * - Mentions configured Support roles (from RoleConfig.supportRoleIds)
 * - Does nothing if no support roles are configured
 * - Replies ephemerally to the clicker confirming the call
 *
 * Note: Uses ephemeral ack to avoid token expiry issues.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handle(interaction) {
  try {
    // Acknowledge quickly
    try { await interaction.deferReply({ flags: MessageFlags.Ephemeral }); } catch (_) { }

    const guild = interaction.guild;
    if (!guild) {
      return interaction.editReply({ content: '❌ This action is only available inside servers.' });
    }

    const mentions = await buildSupportRoleMentions(guild);
    if (!mentions) {
      await interaction.editReply({ content: '⚠️ No Support roles configured. Ask an administrator to configure them in /config → Roles.' });
      return;
    }

    // Post a call message in the same channel/thread
    try {
      await interaction.channel?.send({ content: `📣 ${mentions} — Support requested by <@${interaction.user.id}>.` });

      // Log the support role mention
      const cfg = await getOrCreateRoleConfig(guild.id);
      const supportRoleIds = Array.isArray(cfg?.supportRoleIds) ? cfg.supportRoleIds : [];
      if (supportRoleIds.length > 0) {
        await logRoleMention(
          guild,
          supportRoleIds,
          `Support call button - mentioning support roles in channel ${interaction.channel?.id}`,
          interaction.user.id
        );
      }
    } catch (_) { }

    await interaction.editReply({ content: '✅ Support has been called.' });
    return;
  } catch (error) {
    LoggerService.error('Error in button support:call:', { error: error?.message });
    const msg = { content: '❌ Could not call support.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

