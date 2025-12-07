/**
 * User command handlers
 * Extracted from user.js to comply with max-lines rule
 */
const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed,
  createInfoEmbed
} = require('../../utils/embeds/embedBuilder');
const { buildUserProfileDisplayComponents } = require('../../utils/embeds/profileEmbed');
const { isModeratorOrHoster } = require('../../utils/core/permissions');
const {
  findUserGuildRefs,
  cleanupUserFromAllGuildAssociations
} = require('../../utils/roster/rosterCleanup');
const { clearAllCooldown } = require('../../utils/rate-limiting/guildTransitionOverride');
const { auditAdminAction } = require('../../utils/misc/adminAudit');
const UserProfile = require('../../models/user/UserProfile');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle /user profile
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleProfile(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });

    const target = interaction.options.getUser('target') || interaction.user;
    const { container } = await buildUserProfileDisplayComponents(
      interaction.guild,
      interaction.user,
      target
    );

    await interaction.editReply({
      components: [container]
    });
  } catch (error) {
    LoggerService.error('Error in /user profile:', { error: error.message });
    const replied = interaction.deferred || interaction.replied;
    const method = replied ? 'editReply' : 'reply';
    return interaction[method]({
      content: '❌ An error occurred.',
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle /user fix-guild
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleFixGuild(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const allowed = await isModeratorOrHoster(member, interaction.guild.id);

    if (!allowed) {
      const container = createErrorEmbed(
        'Permission denied',
        'Only administrators, moderators or hosters can use this command.'
      );
      return interaction.editReply({ components: [container] });
    }

    const target = interaction.options.getUser('target', true);
    const apply = interaction.options.getBoolean('apply') || false;
    const forceRemoveLeader = interaction.options.getBoolean(
      'force_remove_leader'
    ) || false;
    const clearCooldown = interaction.options.getBoolean('clear_cooldown');

    const refs = await findUserGuildRefs(interaction.guild.id, target.id);

    if (!refs.length) {
      const container = createInfoEmbed(
        'No associations found',
        `User <@${target.id}> is not referenced in any guild.`
      );
      return interaction.editReply({ components: [container] });
    }

    const lines = refs.map(r => {
      const f = r.refs;
      const tags = [
        f.leader ? 'leader' : (f.coLeader ? 'co-leader' : (
          f.member ? 'member' : null
        )),
        f.main ? 'main' : null,
        f.sub ? 'sub' : null,
      ].filter(Boolean);
      return `• ${r.name} — ${tags.join(', ')}`;
    });

    if (!apply) {
      const container = createInfoEmbed('Diagnostic results', [
        `Found ${refs.length} guild reference(s) for <@${target.id}>:`,
        ...lines,
        '',
        'Run again with apply=true to remove from rosters.'
      ].join('\n'));
      return interaction.editReply({ components: [container] });
    }

    const res = await cleanupUserFromAllGuildAssociations(
      interaction.client,
      interaction.guild.id,
      target.id,
      {
        notifyLeaders: true,
        recordCooldown: false,
        removeFromMembers: true,
        forceRemoveLeader,
        leaverUsername: target.username,
        when: new Date(),
      }
    );

    if (clearCooldown !== false) {
      try {
        await clearAllCooldown(interaction.guild.id, target.id);
      } catch (_) {}
    }

    const container = createSuccessEmbed(
      'User guild associations fixed',
      [
        `Processed ${res.affected} guild(s).`,
        `Updated ${res.changed} record(s).`,
        forceRemoveLeader
          ? 'Leaders were removed when matched.'
          : 'Leaders were preserved.',
        (clearCooldown !== false)
          ? 'Transition cooldown cleared.'
          : 'Transition cooldown not modified.'
      ].join('\n')
    );
    return interaction.editReply({ components: [container] });
  } catch (error) {
    LoggerService.error('Error in /user fix-guild:', {
      error: error.message
    });
    const container = createErrorEmbed(
      'Error',
      error?.message || 'Could not fix user guild associations.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [container],
        flags: MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral
    });
  }
}

/**
 * Handle /user reset-ratings
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleResetRatings(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const allowed = await isModeratorOrHoster(member, interaction.guild.id);

    if (!allowed) {
      const container = createErrorEmbed(
        'Permission denied',
        'Only administrators, moderators or hosters can use this command.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const confirm = interaction.options.getBoolean('confirm');

    if (!confirm) {
      const container = createErrorEmbed(
        'Confirmation required',
        'Pass confirm=true to proceed. This will reset ALL users\' ratings.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const res = await UserProfile.updateMany({}, {
      $set: { elo: 800, peakElo: 800, wagerElo: 800, wagerPeakElo: 800 }
    });

    try {
      await auditAdminAction(
        interaction.guild,
        interaction.user.id,
        'Reset User Ratings',
        { modifiedCount: res?.modifiedCount || 0 }
      );
    } catch (_) {}

    const container = createSuccessEmbed(
      'User ratings reset',
      `Updated ratings to 800 for ${res?.modifiedCount || 0} users.`
    );
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in /user reset-ratings:', {
      error: error.message
    });
    const container = createErrorEmbed(
      'Error',
      error?.message || 'Could not reset user ratings.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
    });
  }
}

module.exports = {
  handleProfile,
  handleFixGuild,
  handleResetRatings
};
