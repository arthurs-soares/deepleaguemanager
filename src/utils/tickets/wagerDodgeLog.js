const { ChannelType, MessageFlags } = require('discord.js');
const { buildWagerDodgeEmbed } = require('../embeds/wagerDodgeEmbed');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const LoggerService = require('../../services/LoggerService');

/**
 * Send wager dodge log to the configured dodge channel
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {import('discord.js').User} dodgerUser - User who dodged
 * @param {import('discord.js').User} opponentUser - Opponent user
 * @param {string} markedByUserId - ID of user/bot who marked the dodge
 * @param {string} [contentPrefix] - Optional content prefix
 */
async function sendWagerDodgeLog(guild, dodgerUser, opponentUser, markedByUserId, contentPrefix) {
  try {
    const serverCfg = await getOrCreateServerSettings(guild.id);
    if (!serverCfg?.wagerDodgeChannelId) {
      LoggerService.warn('Wager dodge channel not configured', {
        guildId: guild.id
      });
      return;
    }

    let dodgeChannel = guild.channels.cache.get(serverCfg.wagerDodgeChannelId);
    if (!dodgeChannel) {
      try {
        dodgeChannel = await guild.channels.fetch(serverCfg.wagerDodgeChannelId);
      } catch (_) {
        LoggerService.warn('Failed to fetch wager dodge channel', {
          channelId: serverCfg.wagerDodgeChannelId
        });
        return;
      }
    }
    if (!dodgeChannel || dodgeChannel.type !== ChannelType.GuildText) {
      LoggerService.warn('Wager dodge channel invalid or not text', {
        channelId: serverCfg.wagerDodgeChannelId
      });
      return;
    }

    const { container, attachment } = await buildWagerDodgeEmbed(
      dodgerUser,
      opponentUser,
      markedByUserId,
      new Date()
    );

    // Send container with attachment in same message for attachment:// to work
    await dodgeChannel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2,
      content: contentPrefix || undefined,
      files: attachment ? [attachment] : []
    });

    LoggerService.info('Wager dodge log sent', {
      channelId: serverCfg.wagerDodgeChannelId,
      dodgerId: dodgerUser?.id
    });
  } catch (err) {
    LoggerService.warn('Failed to send wager dodge log:', { error: err?.message });
  }
}

module.exports = { sendWagerDodgeLog };
