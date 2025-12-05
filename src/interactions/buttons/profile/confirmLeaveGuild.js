const Guild = require('../../../models/guild/Guild');
const {
  leaveFromRegion,
  leaveFromAllRegions
} = require('../../../utils/guilds/leaveGuildHelpers');
const { MessageFlags } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Confirm/deny user leaving the guild
 * CustomIds: profile:confirmLeave:yes | profile:confirmLeave:yes:<region>
 *            profile:confirmLeave:no
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const isYes = parts[2] === 'yes';
    const regionParam = parts[3] ? parts[3].replace(/_/g, ' ') : null;

    if (!isYes) {
      return interaction.reply({
        content: 'Action cancelled.',
        flags: MessageFlags.Ephemeral
      });
    }

    const doc = await Guild.findOne({
      discordGuildId: interaction.guild.id,
      $or: [
        { members: { $elemMatch: { userId: interaction.user.id } } },
        { 'regions.mainRoster': interaction.user.id },
        { 'regions.subRoster': interaction.user.id },
      ]
    });

    if (!doc) {
      return interaction.reply({
        content: '⚠️ You are not in any registered guild.',
        flags: MessageFlags.Ephemeral
      });
    }

    const members = Array.isArray(doc.members) ? doc.members : [];
    const me = members.find(m => m.userId === interaction.user.id);

    if (me?.role === 'lider') {
      return interaction.reply({
        content: '❌ Leader cannot leave. Transfer leadership first.',
        flags: MessageFlags.Ephemeral
      });
    }

    const leaderMember = members.find(m => m.role === 'lider');
    const leaderId = leaderMember?.userId || null;
    const leaverUsername = interaction.user.tag || interaction.user.username;
    const when = new Date();

    if (regionParam) {
      const result = await leaveFromRegion({
        doc,
        userId: interaction.user.id,
        region: regionParam,
        leaderId,
        leaverUsername,
        when,
        client: interaction.client,
        discordGuildId: interaction.guild.id
      });

      return interaction.reply({
        content: result.success
          ? `✅ ${result.message}` : `⚠️ ${result.message}`,
        flags: MessageFlags.Ephemeral
      });
    }

    const result = await leaveFromAllRegions({
      doc,
      userId: interaction.user.id,
      members,
      leaderId,
      leaverUsername,
      when,
      client: interaction.client,
      discordGuildId: interaction.guild.id
    });

    return interaction.reply({
      content: `✅ ${result.message}`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error leaving guild:', { error: error.message });
    const msg = {
      content: '❌ Could not complete the action.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

