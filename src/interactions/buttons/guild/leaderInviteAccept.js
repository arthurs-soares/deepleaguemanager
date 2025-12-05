const { MessageFlags } = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const {
  transferLeadership,
  isGuildLeader
} = require('../../../utils/guilds/guildMemberManager');
const { sendDmOrFallback } = require('../../../utils/dm/dmFallback');
const LoggerService = require('../../../services/LoggerService');

/**
 * Safely defer reply as ephemeral
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function safeDeferEphemeral(interaction) {
  try {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    }
  } catch (_) {}
}

/**
 * Notify the inviter that leadership invite was accepted
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {object} guildDoc
 * @param {string} inviterId
 * @param {string} userId
 */
async function notifyInviterOnAccept(interaction, guildDoc, inviterId, userId) {
  if (!inviterId || inviterId === 'unknown') return;

  try {
    const embed = createSuccessEmbed(
      'Leadership Accepted',
      `User <@${userId}> (${interaction.user.username}) accepted ` +
      `your leadership transfer invitation for "${guildDoc.name}".` +
      `\n\nYou are now a regular member of the guild.`
    );

    await sendDmOrFallback(
      interaction.client,
      guildDoc.discordGuildId,
      inviterId,
      { components: [embed], flags: MessageFlags.IsComponentsV2 },
      {
        threadTitle: `Leadership Accepted — ${guildDoc.name}`,
        reason: `Notify inviter ${inviterId} about acceptance`
      }
    );
  } catch (_) { /* ignore notification errors */ }
}

/**
 * Button handler for accepting a leadership invitation via DM
 * CustomId: leaderInvite:accept:<guildId>:<inviterId>
 */
async function handle(interaction) {
  try {
    await safeDeferEphemeral(interaction);

    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const inviterId = parts[3] || null;
    const userId = interaction.user.id;

    if (!guildId) {
      const embed = createErrorEmbed(
        'Invalid invitation',
        'Missing guild information.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
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
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Check if user is already the leader
    if (isGuildLeader(guildDoc, userId)) {
      const embed = createErrorEmbed(
        'Already leader',
        'You are already the leader of this guild.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Transfer leadership
    const result = await transferLeadership(
      guildId,
      userId,
      interaction.user.username
    );

    if (!result.success) {
      const embed = createErrorEmbed(
        'Transfer failed',
        result.message || 'Could not complete the leadership transfer.'
      );
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2
      });
    }

    // Disable buttons after success
    try {
      await interaction.message.edit({ components: [] });
    } catch (_) { /* ignore */ }

    const container = createSuccessEmbed(
      'You are now the Leader',
      `You have accepted the leadership of "${guildDoc.name}". ` +
      'You now have full control over the guild.'
    );

    // Notify inviter
    await notifyInviterOnAccept(interaction, guildDoc, inviterId, userId);

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    LoggerService.error('Error in leaderInviteAccept:', { error });
    const container = createErrorEmbed(
      'Error',
      'An error occurred while processing your acceptance.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };
