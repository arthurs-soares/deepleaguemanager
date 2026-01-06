/**
 * Guild region handlers
 * Handles add-region and remove-region subcommands
 */
const { MessageFlags } = require('discord.js');
const {
  findGuildByName,
  addGuildToRegion,
  removeGuildFromRegion
} = require('../../utils/guilds/guildManager');
const {
  createErrorEmbed,
  createInfoEmbed,
  createSuccessEmbed
} = require('../../utils/embeds/embedBuilder');
const { ensureAdminOrReply } = require('../../utils/commands/permissionGuards');
const { safeDeferReply } = require('../../utils/core/ack');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle /guild add-region
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleAddRegion(interaction) {
  if (!(await ensureAdminOrReply(interaction))) return;
  const deferred = await safeDeferReply(interaction);
  if (!deferred) return;

  try {
    const name = interaction.options.getString('name', true);
    const region = interaction.options.getString('region', true);

    const guild = await findGuildByName(name, interaction.guild.id);
    if (!guild) {
      const container = createInfoEmbed(
        'Guild not found',
        'No guild with that name was found.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const result = await addGuildToRegion(
      guild._id,
      region,
      interaction.user.id
    );

    const container = result.success
      ? createSuccessEmbed('Region Added', result.message)
      : createErrorEmbed('Error', result.message);

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in /guild add-region:', { error: error.message });
    const container = createErrorEmbed('Error', 'An error occurred.');
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
}

/**
 * Handle /guild remove-region
 * @param {ChatInputCommandInteraction} interaction - Interaction
 * @returns {Promise<void>}
 */
async function handleRemoveRegion(interaction) {
  if (!(await ensureAdminOrReply(interaction))) return;
  const deferred = await safeDeferReply(interaction);
  if (!deferred) return;

  try {
    const name = interaction.options.getString('name', true);
    const region = interaction.options.getString('region', true);

    const guild = await findGuildByName(name, interaction.guild.id);
    if (!guild) {
      const container = createInfoEmbed(
        'Guild not found',
        'No guild with that name was found.'
      );
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }

    const result = await removeGuildFromRegion(guild._id, region);

    const container = result.success
      ? createSuccessEmbed('Region Removed', result.message)
      : createErrorEmbed('Error', result.message);

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in /guild remove-region:', {
      error: error.message
    });
    const container = createErrorEmbed('Error', 'An error occurred.');
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }
}

module.exports = {
  handleAddRegion,
  handleRemoveRegion
};
