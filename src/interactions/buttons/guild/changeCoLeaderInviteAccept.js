const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
    createErrorEmbed,
    createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { safeDeferEphemeral } = require('../../../utils/core/ack');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { logRoleAssignment } = require('../../../utils/core/roleLogger');
const { sendDmOrFallback } = require('../../../utils/dm/dmFallback');
const LoggerService = require('../../../services/LoggerService');

/**
 * Button handler for accepting a co-leader REPLACEMENT invitation via DM
 * CustomId: changeCoLeaderInvite:accept:<guildId>:<inviterId>:<oldCoLeaderId>
 */
async function handle(interaction) {
    try {
        await safeDeferEphemeral(interaction);

        const parts = interaction.customId.split(':');
        const guildId = parts[2];
        const inviterId = parts[3] || null;
        const oldCoLeaderId = parts[4] || null;

        if (!guildId) {
            const embed = createErrorEmbed(
                'Invalid invitation',
                'Missing guild information.'
            );
            return interaction.editReply({
                components: [embed],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const guildDoc = await Guild.findById(guildId);
        if (!guildDoc) {
            const embed = createErrorEmbed(
                'Guild not found',
                'This invitation refers to a guild that no longer exists.'
            );
            return interaction.editReply({
                components: [embed],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        const userId = interaction.user.id;
        const members = Array.isArray(guildDoc.members) ? [...guildDoc.members] : [];

        // Check if user is already co-leader
        const existingCoLeader = members.find(
            m => m.userId === userId && m.role === 'vice-lider'
        );
        if (existingCoLeader) {
            const embed = createErrorEmbed(
                'Already co-leader',
                'You are already the co-leader of this guild.'
            );
            return interaction.editReply({
                components: [embed],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        // Identify the CURRENT co-leader in DB
        const currentCo = members.find(m => m.role === 'vice-lider');

        // Verify consistency: 
        // If there is a co-leader, is it the one we expect?
        // If not, maybe they changed already. We proceed anyway but log it.
        if (currentCo && oldCoLeaderId && currentCo.userId !== oldCoLeaderId) {
            // Warning: The co-leader has changed since the invite was sent.
            // However, the invite authorizes THIS user to take over. 
            // We should arguably proceed and displace whoever is there, 
            // OR fail if it's not the expected person. 
            // To avoid race conditions, let's fail if the slot is occupied by someone else.
            const embed = createErrorEmbed(
                'Slot changed',
                'The co-leader position has changed since this invite was sent.'
            );
            return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
        }

        // Add user as member if not present or get existing
        let targetMember = members.find(m => m.userId === userId);
        if (!targetMember) {
            targetMember = {
                userId,
                username: interaction.user.username,
                role: 'vice-lider',
                joinedAt: new Date()
            };
            members.push(targetMember);
        } else {
            targetMember.role = 'vice-lider';
        }

        // Demote current co-leader if exists
        if (currentCo && currentCo.userId !== userId) {
            currentCo.role = 'membro';
        }

        guildDoc.members = members;
        await guildDoc.save();

        // Handle Discord Roles
        const cfg = await getOrCreateRoleConfig(guildDoc.discordGuildId);
        const coRoleId = cfg?.coLeadersRoleId;
        if (coRoleId) {
            try {
                const discordGuild = interaction.client.guilds.cache.get(guildDoc.discordGuildId);
                if (discordGuild) {
                    const role = discordGuild.roles.cache.get(coRoleId);
                    if (role) {
                        // Remove from old
                        if (currentCo && currentCo.userId) {
                            const oldMem = await discordGuild.members.fetch(currentCo.userId).catch(() => null);
                            if (oldMem) await oldMem.roles.remove(coRoleId).catch(() => { });
                        }
                        // Add to new
                        const newMem = await discordGuild.members.fetch(userId).catch(() => null);
                        if (newMem && !newMem.roles.cache.has(coRoleId)) {
                            await newMem.roles.add(coRoleId);
                            await logRoleAssignment(
                                discordGuild, userId, coRoleId, role.name, inviterId || 'system', 'Co-leader (Replacement) via Invite'
                            );
                        }
                    }
                }
            } catch (_) { }
        }

        // Notifications
        await sendChangeNotifications(interaction, guildDoc, currentCo?.userId, userId);

        // Disable buttons
        try {
            await interaction.message.edit({ components: [] });
        } catch (_) { /* ignore */ }

        const embed = createSuccessEmbed(
            'You are now Co-Leader!',
            `You have accepted the invitation and are now the Co-Leader of "${guildDoc.name}".`
        );
        return interaction.editReply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2
        });

    } catch (error) {
        LoggerService.error('Error in changeCoLeaderInviteAccept:', { error });
        const embed = createErrorEmbed('Error', 'Could not accept invitation.');
        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({
                components: [embed],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }
        return interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
}

async function sendChangeNotifications(interaction, guildDoc, oldId, newId) {
    const { sendDmOrFallback } = require('../../../utils/dm/dmFallback');
    // Notify old
    if (oldId) {
        try {
            const embed = createErrorEmbed('Co-leadership removed', `You are no longer co-leader of guild **${guildDoc.name}**.`);
            await sendDmOrFallback(interaction.client, guildDoc.discordGuildId, oldId, { embeds: [embed] }, { threadTitle: `Role Change — ${guildDoc.name}` });
        } catch (_) { }
    }
    // Notify new is implicitly handled by the acceptance reply? 
    // But maybe send a DM notification too if they clicked it in a thread? 
    // No, the acceptance reply is sufficient for the accepter.
}

module.exports = { handle };
