const { ThreadAutoArchiveDuration, ChannelType } = require('discord.js');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const LoggerService = require('../../services/LoggerService');
const {
  addUserToThread,
  verifyUserInThread,
  sendThreadMessages
} = require('./dmFallbackHelpers');

/**
 * Try to send a DM; if it fails, create a private thread fallback.
 * @param {import('discord.js').Client} client
 * @param {string} discordGuildId
 * @param {string} targetUserId
 * @param {import('discord.js').MessageCreateOptions} dmPayload
 * @param {Object} [options]
 * @returns {Promise<{ ok: boolean, via: 'dm'|'thread', threadId?: string }>}
 */
async function sendDmOrFallback(client, discordGuildId, targetUserId, dmPayload, options = {}) {
  const { logDmSent, logDmFailed } = require('../misc/logEvents');
  const guild = client.guilds.cache.get(discordGuildId);
  const failResult = { ok: false, via: 'dm' };

  // Attempt direct DM first
  try {
    const user = await client.users.fetch(targetUserId).catch(() => null);
    if (user) {
      const sent = await user.send(dmPayload).catch(() => null);
      if (sent) {
        if (guild) await logDmSent(guild, targetUserId, options.reason || 'System DM');
        return { ok: true, via: 'dm' };
      }
    }
  } catch (_) { /* fallback */ }

  // Fallback to private thread
  if (!guild) {
    LoggerService.warn('[dmFallback] Guild not found for fallback', {
      discordGuildId,
      targetUserId
    });
    return failResult;
  }

  const settings = await getOrCreateServerSettings(discordGuildId);
  const channelId = settings?.dmWarningChannelId;
  if (!channelId) {
    LoggerService.warn('[dmFallback] No dmWarningChannelId configured', {
      discordGuildId,
      targetUserId
    });
    return failResult;
  }

  const base = channelId ? guild.channels.cache.get(channelId) : null;
  if (!base || !base.isTextBased?.()) {
    LoggerService.warn('[dmFallback] Fallback channel not found or invalid', {
      discordGuildId,
      channelId,
      targetUserId
    });
    return failResult;
  }

  const threadName = (options.threadTitle || `[DM Fallback] ${targetUserId}`)
    .slice(0, 90);
  const thread = await base.threads.create({
    name: threadName,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
    type: ChannelType.PrivateThread,
    invitable: true,
    reason: options.reason || `Fallback for DM to <@${targetUserId}>`
  }).catch(err => {
    LoggerService.warn('[dmFallback] Failed to create fallback thread', {
      discordGuildId,
      channelId,
      targetUserId,
      error: err?.message
    });
    return null;
  });

  if (!thread) return failResult;

  // Add user to thread FIRST (so they get notified)
  let userAdded = await addUserToThread(thread, targetUserId);

  // If add failed, try once more after a short delay
  if (!userAdded) {
    await new Promise(r => setTimeout(r, 1000));
    userAdded = await addUserToThread(thread, targetUserId, 1);
  }

  // Send messages (mention reinforces the notification)
  await sendThreadMessages(
    thread,
    targetUserId,
    dmPayload,
    options.includeSupportCloseButton
  );

  // Final verification - try adding again if still not in thread
  if (!userAdded) {
    userAdded = await verifyUserInThread(thread, targetUserId);
    if (!userAdded) {
      // Last resort: try adding one more time
      userAdded = await addUserToThread(thread, targetUserId, 0);
      if (!userAdded) {
        userAdded = await verifyUserInThread(thread, targetUserId);
      }
    }
  }

  if (!userAdded) {
    LoggerService.error('[dmFallback] User NOT in thread after all attempts', {
      targetUserId,
      threadId: thread.id,
      threadName: thread.name
    });
  } else {
    LoggerService.info('[dmFallback] User successfully added to thread', {
      targetUserId,
      threadId: thread.id
    });
  }

  try {
    await logDmFailed(
      guild,
      targetUserId,
      options.reason || 'User privacy settings',
      `Private thread created: ${thread.id}`
    );
  } catch (_) {}

  return { ok: true, via: 'thread', threadId: thread.id };
}

module.exports = { sendDmOrFallback };
