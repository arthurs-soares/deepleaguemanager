const { ChannelType, MessageFlags } = require('discord.js');
const { buildWarDodgeEmbed } = require('../embeds/warDodgeEmbed');
const { getOrCreateServerSettings } = require('../system/serverSettings');
const LoggerService = require('../../services/LoggerService');

/**
 * Send war dodge log to the configured dodge channel
 * @param {import('discord.js').Guild} guild - Discord guild
 * @param {string} dodgerName - Name of the guild that dodged
 * @param {string} targetName - Name of the target guild
 * @param {string} markedByUserId - ID of user who marked the dodge
 */
async function sendWarDodgeLog(guild, dodgerName, targetName, markedByUserId) {
  try {
    const serverCfg = await getOrCreateServerSettings(guild.id);
    if (!serverCfg?.warDodgeChannelId) {
      LoggerService.warn('War dodge channel not configured', {
        guildId: guild.id
      });
      return;
    }

    let dodgeChannel = guild.channels.cache.get(serverCfg.warDodgeChannelId);
    if (!dodgeChannel) {
      try {
        dodgeChannel = await guild.channels.fetch(serverCfg.warDodgeChannelId);
      } catch (_) {
        LoggerService.warn('Failed to fetch war dodge channel', {
          channelId: serverCfg.warDodgeChannelId
        });
        return;
      }
    }
    if (!dodgeChannel || dodgeChannel.type !== ChannelType.GuildText) {
      LoggerService.warn('War dodge channel invalid or not text', {
        channelId: serverCfg.warDodgeChannelId
      });
      return;
    }

    const container = buildWarDodgeEmbed(
      dodgerName,
      targetName,
      markedByUserId,
      null,
      new Date()
    );

    await dodgeChannel.send({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    LoggerService.info('War dodge log sent', {
      channelId: serverCfg.warDodgeChannelId,
      dodgerName
    });
  } catch (err) {
    LoggerService.warn('Failed to send war dodge log:', {
      error: err?.message
    });
  }
}

module.exports = { sendWarDodgeLog };
