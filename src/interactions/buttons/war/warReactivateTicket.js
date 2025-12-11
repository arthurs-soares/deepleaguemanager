const { MessageFlags } = require('discord.js');
const War = require('../../../models/war/War');
const { getOrCreateRoleConfig } = require('../../../services/ServerConfigService');
const LoggerService = require('../../../services/LoggerService');
const { isDatabaseConnected } = require('../../../utils/database/connectionHelper');

/**
 * Check if user has hoster or moderator permissions
 * @param {import('discord.js').GuildMember} member
 * @param {string} guildId
 * @returns {Promise<boolean>}
 */
async function hasReactivatePermission(member, guildId) {
    // Administrators always have permission
    if (member.permissions.has('Administrator')) return true;

    try {
        const rolesCfg = await getOrCreateRoleConfig(guildId);
        const hosterIds = rolesCfg?.hostersRoleIds || [];
        const modIds = rolesCfg?.moderatorsRoleIds || [];

        const allAllowedRoles = [...hosterIds, ...modIds];
        return member.roles.cache.some(r => allAllowedRoles.includes(r.id));
    } catch (_) {
        return false;
    }
}

/**
 * Reactivate a war ticket for another 7 days
 * Only hosters, moderators, or administrators can do this
 * CustomId: war:reactivate:<warId>
 */
async function handle(interaction) {
    try {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const [, , warId] = interaction.customId.split(':');

        if (!warId) {
            return interaction.editReply({ content: '❌ War ID not provided.' });
        }

        if (!isDatabaseConnected()) {
            return interaction.editReply({ content: '❌ Database is temporarily unavailable.' });
        }

        // Check permissions
        const member = await interaction.guild.members.fetch(interaction.user.id);
        if (!(await hasReactivatePermission(member, interaction.guild.id))) {
            return interaction.editReply({
                content: '❌ Only **Hosters**, **Moderators**, or **Administrators** can reactivate war tickets.'
            });
        }

        // Find the war ticket
        const war = await War.findById(warId);

        if (!war) {
            return interaction.editReply({ content: '❌ War ticket not found.' });
        }

        if (war.status !== 'aberta') {
            return interaction.editReply({ content: '❌ This war ticket is no longer open.' });
        }

        // Reactivate the ticket
        war.inactivityReactivatedAt = new Date();
        war.lastInactivityWarningAt = null; // Reset warning so it won't trigger again for 7 days
        await war.save();

        // Update the message to show it was reactivated
        try {
            await interaction.message.edit({
                content: `✅ **Ticket Reactivated**\n\nThis war ticket has been reactivated by <@${interaction.user.id}>.\n\nThe ticket will remain open for another 7 days of activity.`,
                components: [] // Remove the button
            });
        } catch (_) {
            // If we can't edit the original message, just log it
            LoggerService.warn('[War Reactivate] Could not edit original warning message');
        }

        // Send confirmation in the channel
        try {
            await interaction.channel.send({
                content: `🔄 <@${interaction.user.id}> reactivated this war ticket. The inactivity timer has been reset for another 7 days.`
            });
        } catch (_) {
            // Ignore if we can't send
        }

        LoggerService.info(`[War Reactivate] War ticket ${warId} reactivated by ${interaction.user.id}`);

        return interaction.editReply({
            content: '✅ War ticket reactivated successfully! The inactivity timer has been reset for another 7 days.'
        });

    } catch (error) {
        LoggerService.error('Error in war:reactivate button:', { error: error?.message });
        const msg = { content: '❌ Could not reactivate the ticket.', flags: MessageFlags.Ephemeral };
        if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
        return interaction.reply(msg);
    }
}

module.exports = { handle };
