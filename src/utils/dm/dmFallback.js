const { ThreadAutoArchiveDuration, ChannelType } = require('discord.js');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const { buildSupportCloseButtonRow } = require('../tickets/closeButtons');

/**
 * Try to send a DM and, if it fails, create a private thread in the configured DM Warning channel.
 * The thread mentions moderators and the target user, and includes the original payload/components.
 *
 * @param {import('discord.js').Client} client
 * @param {string} discordGuildId
 * @param {string} targetUserId
 * @param {import('discord.js').MessageCreateOptions | import('discord.js').BaseMessageOptions} dmPayload
 * @param {{ threadTitle?: string, reason?: string, mentionSupportRoles?: boolean, includeSupportCloseButton?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, via: 'dm'|'thread', threadId?: string }>}
 */
async function sendDmOrFallback(client, discordGuildId, targetUserId, dmPayload, options = {}) {
  const { logDmSent, logDmFailed } = require('../misc/logEvents');
  const guild = client.guilds.cache.get(discordGuildId);

  try {
    const user = await client.users.fetch(targetUserId).catch(() => null);
    if (user) {
      const sent = await user.send(dmPayload).catch(() => null);
      if (sent) {
        // Log DM enviada com sucesso
        if (guild) {
          await logDmSent(guild, targetUserId, options.reason || 'DM do sistema');
        }
        return { ok: true, via: 'dm' };
      }
    }
  } catch (_) { /* ignore and fallback */ }

  // Fallback to private thread
  try {
    if (!guild) return { ok: false, via: 'dm' };

    const settings = await getOrCreateServerSettings(discordGuildId);
    const channelId = settings?.dmWarningChannelId;
    const base = channelId ? guild.channels.cache.get(channelId) : null;
    if (!base || !base.isTextBased?.()) return { ok: false, via: 'dm' };

    const threadName = (options.threadTitle || `[DM Fallback] ${targetUserId}`).slice(0, 90);
    const thread = await base.threads.create({
      name: threadName,
      autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
      type: ChannelType.PrivateThread,
      invitable: false,
      reason: options.reason || `Fallback for DM to <@${targetUserId}>`
    }).catch(() => null);
    if (!thread) return { ok: false, via: 'dm' };

    // Add target user to the thread first (so they can see/respond)
    try { await thread.members.add(targetUserId); } catch (_) {}

    // Mention target user only; staff can be notified via the Call Support button
    const header = `<@${targetUserId}>\nThe bot could not send a DM due to privacy settings. Original message is below:`.trim();

    const components = options.includeSupportCloseButton ? [buildSupportCloseButtonRow()] : [];

    // Send a single header message including the close/call buttons, then the original payload
    try { await thread.send({ content: header, components }); } catch (_) {}
    try { await thread.send(dmPayload); } catch (_) {}

    // Log fallback de DM
    try {
      await logDmFailed(
        guild,
        targetUserId,
        options.reason || 'Configurações de privacidade do usuário',
        `Thread privada criada: ${thread.id}`
      );
    } catch (_) {}

    return { ok: true, via: 'thread', threadId: thread.id };
  } catch (_) {
    // Log falha completa ao enviar DM (sem fallback)
    if (guild) {
      try {
        await logDmFailed(
          guild,
          targetUserId,
          options.reason || 'Erro ao enviar DM e criar thread',
          'Nenhuma ação de fallback disponível'
        );
      } catch (_) {}
    }
    return { ok: false, via: 'dm' };
  }
}

module.exports = { sendDmOrFallback };
