const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const { getUserGuildInfo } = require('../../../utils/guilds/userGuildInfo');
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

        const userId = interaction.user.id;

        // Pre-fetch guild to validate existence and check cross-guild membership
        const preGuildCheck = await Guild.findById(guildId).select('discordGuildId name');
        if (!preGuildCheck) {
            const embed = createErrorEmbed('Not found', 'Guild no longer exists.');
            return interaction.editReply({
                components: [embed],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        // Check cross-guild membership
        const { guild: existingGuild } = await getUserGuildInfo(
            preGuildCheck.discordGuildId,
            userId
        );

        if (existingGuild && String(existingGuild._id) !== String(guildId)) {
            const embed = createErrorEmbed(
                'Already in a guild',
                `You are already a member of "${existingGuild.name}". You must leave it first.`
            );
            return interaction.editReply({
                components: [embed],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
            });
        }

        // Define safety condition: Either no co-leader exists, OR the existing one matches oldCoLeaderId
        const safetyCondition = [];
        // Condition 1: No co-leader exists (safe to take over)
        safetyCondition.push({ "members": { $not: { $elemMatch: { role: 'vice-lider' } } } });

        // Condition 2: Current co-leader is the one we are replacing
        if (oldCoLeaderId) {
            safetyCondition.push({ "members": { $elemMatch: { role: 'vice-lider', userId: oldCoLeaderId } } });
        }

        const baseQuery = {
            _id: guildId,
            $or: safetyCondition
        };

        // Step 1: Promote existing member
        // Demote any existing co-leader (who isn't us), Promote us.
        let updatedGuild = await Guild.findOneAndUpdate(
            {
                ...baseQuery,
                "members.userId": userId
            },
            {
                $set: {
                    "members.$[old].role": "membro",
                    "members.$[target].role": "vice-lider"
                }
            },
            {
                new: true,
                arrayFilters: [
                    { "old.role": "vice-lider", "old.userId": { $ne: userId } },
                    { "target.userId": userId }
                ]
            }
        );

        // Step 2: Add new member
        if (!updatedGuild) {
            updatedGuild = await Guild.findOneAndUpdate(
                {
                    ...baseQuery,
                    "members.userId": { $ne: userId }
                },
                {
                    $set: { "members.$[old].role": "membro" },
                    $push: {
                        members: {
                            userId,
                            username: interaction.user.username,
                            role: 'vice-lider',
                            joinedAt: new Date()
                        }
                    }
                },
                {
                    new: true,
                    arrayFilters: [
                        { "old.role": "vice-lider" }
                    ]
                }
            );
        }

        if (!updatedGuild) {
            // Diagnose failure
            const checkGuild = await Guild.findById(guildId);
            if (!checkGuild) {
                const embed = createErrorEmbed('Guild not found', 'Guild no longer exists.');
                return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }

            const members = checkGuild.members || [];
            const currentCo = members.find(m => m.role === 'vice-lider');

            if (members.some(m => m.userId === userId && m.role === 'vice-lider')) {
                const embed = createErrorEmbed('Already co-leader', 'You are already the co-leader.');
                return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }

            // If current co-leader is not the one we expected
            if (currentCo && oldCoLeaderId && currentCo.userId !== oldCoLeaderId) {
                const embed = createErrorEmbed(
                    'Slot changed',
                    'The co-leader position has changed since this invite was sent.'
                );
                return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
            }

            // If current co-leader exists but we expected None (oldCoLeaderId is null)
            if (currentCo && !oldCoLeaderId) {
                const embed = createErrorEmbed('Limit reached', 'A co-leader was appointed before you accepted.');
                return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 });
            }

            const embed = createErrorEmbed('Error', 'Could not accept invitation due to a state conflict.');
            return interaction.editReply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        const guildDoc = updatedGuild;

        // Identify who was demoted for notifications (best guess based on oldCoLeaderId or current state if we had it)
        // Since we did an atomic update, we know if there WAS an oldCoLeaderId, they were demoted.
        const demotedId = oldCoLeaderId;

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
