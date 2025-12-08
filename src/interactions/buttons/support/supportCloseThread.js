const { PermissionFlagsBits, ChannelType } = require('discord.js');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { sendTranscriptToLogs } = require('../../../utils/tickets/transcript');
const LoggerService = require('../../../services/LoggerService');

/**
 * Check if member can close support fallback threads: Support, Moderators, or Admin
 * @param {import('discord.js').GuildMember} member
 * @param {string} guildId
 */
async function canCloseSupport(member, guildId) {
  try {
    if (!member || !guildId) return false;
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) return true;
    const cfg = await getOrCreateRoleConfig(guildId);
    const allowed = new Set([...(cfg?.supportRoleIds || []), ...(cfg?.moderatorsRoleIds || [])]);
    return member.roles.cache.some(r => allowed.has(r.id));
  } catch (_) {
    return false;
  }
}

/**
 * Close the current private thread (DM fallback) with transcript
 * CustomId: support:closeThread
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.channel;
    const isPrivateThread = channel?.type === ChannelType.PrivateThread;
    if (!isPrivateThread) {
      return interaction.editReply({ content: '❌ This action is only available inside support threads.' });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await canCloseSupport(member, interaction.guild.id))) {
      return interaction.editReply({ content: '❌ Only Support, Moderators or Administrators can close this thread.' });
    }

    // Try to send transcript to logs (support threads use general transcript channel)
    try { await sendTranscriptToLogs(interaction.guild, channel, `Support thread closed by <@${interaction.user.id}>`, null, 'general'); } catch (_) { }

    // Delete the thread (this will also delete the interaction message if it's in this thread)
    try {
      await channel.delete('Support DM fallback thread closed via button.');
    } catch (err) {
      // Try to notify user, but handle case where message was deleted with thread
      try {
        await interaction.editReply({ content: `❌ Could not close this thread: ${err?.message || 'unknown error'}` });
      } catch (e) {
        const code = e?.code ?? e?.rawError?.code;
        if (code !== 10008) throw e; // rethrow unexpected errors
        // Unknown Message: can't notify user, but log the original error
        LoggerService.error('Failed to delete support thread:', { error: err?.message });
      }
      return;
    }

    return;
  } catch (error) {
    LoggerService.error('Error in button support:closeThread:', { error: error?.message });
    const msg = { content: '❌ Could not close the support thread.' };
    if (interaction.deferred || interaction.replied) return interaction.followUp({ ...msg, ephemeral: true });
    return interaction.reply({ ...msg, ephemeral: true });
  }
}

module.exports = { handle };

