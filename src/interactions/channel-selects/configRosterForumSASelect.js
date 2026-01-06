const { ChannelType, MessageFlags } = require('discord.js');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { syncRosterForum } = require('../../utils/roster/rosterForumSync');
const LoggerService = require('../../services/LoggerService');

/**
 * Receives FORUM channel selection for SA region rosters, saves and starts synchronization
 * CustomId: config:channels:selectRosterForumSA
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channelId = interaction.values?.[0];
    if (!channelId) return interaction.editReply({ content: 'Action cancelled.' });

    const channel = interaction.guild.channels.cache.get(channelId);
    if (!channel || channel.type !== ChannelType.GuildForum) {
      return interaction.editReply({ content: '❌ Select a Forum type channel.' });
    }

    const cfg = await getOrCreateServerSettings(interaction.guild.id);
    cfg.rosterForumSAChannelId = channelId;
    await cfg.save();

    // Synchronize posts for SA region (not critical if it fails)
    try {
      await syncRosterForum(interaction.guild, 'South America');
    } catch (err) {
      LoggerService.warn('Failed to synchronize SA roster forum:', { error: err?.message });
    }

    return interaction.editReply({ content: `✅ SA Roster forum set to <#${channelId}>. Starting synchronization...` });
  } catch (error) {
    LoggerService.error('Error saving SA roster forum:', { error: error?.message });
    const msg = { content: '❌ Could not save the forum channel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
