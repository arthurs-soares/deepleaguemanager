/**
 * Guild command handlers
 * Extracted from guild.js to comply with max-lines rule
 */
const { MessageFlags, PermissionFlagsBits } = require('discord.js');
const {
  findGuildByName,
  findGuildsByUser,
  registerGuild,
  deleteGuild
} = require('../../utils/guilds/guildManager');
const {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed
} = require('../../utils/embeds/embedBuilder');
const { buildGuildPanelDisplayComponents } = require('../../utils/embeds/guildPanelEmbed');
const { isGuildAdmin } = require('../../utils/core/permissions');
const { replyEphemeral } = require('../../utils/core/reply');
const {
  validateRegisterInputs,
  buildGuildRegistrationData,
  postRegistration
} = require('../../utils/commands/registerFlow');
const { ensureAdminOrReply } = require('../../utils/commands/permissionGuards');
const {
  handleViewDetails,
  handleViewList
} = require('../../utils/commands/viewGuildsFlow');
const { handleSetScore } = require('../../utils/commands/guildScoreHandler');
const {
  handleAddRegion,
  handleRemoveRegion
} = require('../../utils/commands/guildRegionHandlers');
const {
  safeDeferEphemeral,
  safeDeferReply
} = require('../../utils/core/ack');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle /guild panel
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handlePanel(interaction) {
  const deferred = await safeDeferEphemeral(interaction);
  if (!deferred) return;
  const requestedName = interaction.options.getString('name');

  try {
    if (requestedName) {
      const member = await interaction.guild.members.fetch(interaction.user.id);
      const isAdmin = await isGuildAdmin(member, interaction.guild.id);
      if (!isAdmin) {
        const container = createErrorEmbed(
          'Permission denied',
          'You need to be a server administrator to view another guild\'s panel.'
        );
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }

      const target = await findGuildByName(requestedName, interaction.guild.id);
      if (!target) {
        const container = createInfoEmbed(
          'Guild not found',
          'No guild with that name was found on this server.'
        );
        return interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2
        });
      }

      const container = await buildGuildPanelDisplayComponents(
        target,
        interaction.guild
      );
      return interaction.editReply({
        components: Array.isArray(container) ? container : [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const userGuilds = await findGuildsByUser(
      interaction.user.id,
      interaction.guild.id
    );
    if (!userGuilds || userGuilds.length === 0) {
      const container = createInfoEmbed(
        'No associated guild',
        'You are not the leader, co-leader, or manager of any guild.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const doc = userGuilds[0];
    const container = await buildGuildPanelDisplayComponents(
      doc,
      interaction.guild
    );
    return interaction.editReply({
      components: Array.isArray(container) ? container : [container],
      flags: MessageFlags.IsComponentsV2
    });

  } catch (error) {
    LoggerService.error('Error in /guild panel:', { error: error.message });
    const container = createErrorEmbed('Error', 'An error occurred.');
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
}

/**
 * Handle /guild register
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleRegister(interaction) {
  if (!(await ensureAdminOrReply(interaction))) return;
  const deferred = await safeDeferReply(interaction);
  if (!deferred) return;

  try {
    const validation = validateRegisterInputs(interaction);
    if (!validation.ok) {
      return interaction.editReply({
        components: [validation.container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const guildData = buildGuildRegistrationData(interaction);
    const result = await registerGuild(guildData);

    // Build regions text for success message
    const regionsText = result.guild?.regions
      ? result.guild.regions.map(r => r.region).join(', ')
      : guildData.region;

    const container = result.success
      ? createSuccessEmbed(
        'Guild Registered',
        `**Name:** ${result.guild.name}\n` +
        `**Leader:** ${result.guild.leader}\n` +
        `**Regions:** ${regionsText}\n` +
        `**Registered by:** <@${interaction.user.id}>\n` +
        `**Date:** <t:${Math.floor(result.guild.createdAt.getTime() / 1000)}:F>`
      )
      : createErrorEmbed('Registration Error', result.message);

    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    if (result.success) {
      await postRegistration(interaction, result.guild, guildData.leaderId);
    }
  } catch (error) {
    LoggerService.error('Error in /guild register:', { error: error.message });
    const container = createErrorEmbed('Internal Error', 'An error occurred.');
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
}

/**
 * Handle /guild delete
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleDelete(interaction) {
  try {
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
    if (!isAdmin) {
      const container = createErrorEmbed(
        'Permission denied',
        'Only administrators can delete guilds.'
      );
      return interaction.reply({
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
      });
    }

    const name = interaction.options.getString('name', true);

    await replyEphemeral(interaction, {
      content: `⚠️ Confirm deletion of guild "${name}"? Reply "yes" in 15s.`
    });

    const filter = m => m.author.id === interaction.user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 15_000,
      max: 1
    });

    collector.on('collect', async (m) => {
      try { await m.delete(); } catch (_) {}

      if (m.content.toLowerCase() !== 'yes') {
        return replyEphemeral(interaction, { content: 'Operation cancelled.' });
      }

      const target = await findGuildByName(name, interaction.guild.id);
      if (!target) {
        const container = createInfoEmbed('Not found', 'Guild not found.');
        return replyEphemeral(interaction, { components: [container] });
      }

      const result = await deleteGuild(target._id, interaction.client);
      if (!result.success) {
        const container = createErrorEmbed('Failed', result.message || 'Error.');
        return replyEphemeral(interaction, { components: [container] });
      }

      const container = createSuccessEmbed('Guild deleted', result.message);
      return replyEphemeral(interaction, { components: [container] });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        replyEphemeral(interaction, { content: 'Time expired.' });
      }
    });

  } catch (error) {
    LoggerService.error('Error in /guild delete:', { error: error.message });
    return replyEphemeral(interaction, { content: '❌ An error occurred.' });
  }
}

/**
 * Handle /guild view
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleView(interaction) {
  const deferred = await safeDeferReply(interaction);
  if (!deferred) return;
  try {
    const requestedName = interaction.options.getString('name');
    if (requestedName) return handleViewDetails(interaction, requestedName);
    return handleViewList(interaction);
  } catch (error) {
    LoggerService.error('Error in /guild view:', { error: error.message });
    const container = createErrorEmbed('Error', 'An error occurred.');
    await interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
}

module.exports = {
  handlePanel,
  handleRegister,
  handleDelete,
  handleView,
  handleSetScore,
  handleAddRegion,
  handleRemoveRegion
};
