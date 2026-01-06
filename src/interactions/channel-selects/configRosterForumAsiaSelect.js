const { ChannelType } = require('discord.js');
const { MessageFlags } = require('discord.js');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { syncRosterForum } = require('../../utils/roster/rosterForumSync');
const LoggerService = require('../../services/LoggerService');

/**
 * Receives FORUM channel selection for Asia region rosters, saves and starts synchronization
 * CustomId: config:channels:selectRosterForumAsia
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
        cfg.rosterForumAsiaChannelId = channelId;
        await cfg.save();

        // Synchronize posts for Asia region (not critical if it fails)
        try {
            await syncRosterForum(interaction.guild, 'Asia');
        } catch (err) {
            LoggerService.warn('Failed to synchronize Asia roster forum:', { error: err?.message });
        }

        return interaction.editReply({ content: `✅ Asia Roster forum set to <#${channelId}>. Starting synchronization...` });
    } catch (error) {
        LoggerService.error('Error saving Asia roster forum:', { error: error?.message });
        const msg = {
            content: '❌ Could not save the forum channel.',
            flags: MessageFlags.Ephemeral
        };
        if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
        return interaction.reply(msg);
    }
}

module.exports = { handle };
