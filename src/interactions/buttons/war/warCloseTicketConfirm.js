const { PermissionFlagsBits, ChannelType, MessageFlags } = require('discord.js');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const War = require('../../../models/war/War');
const { sendLog } = require('../../../utils/core/logger');
const { sendTranscriptToLogs } = require('../../../utils/tickets/transcript');
const LoggerService = require('../../../services/LoggerService');

// Helpers
async function hasClosePermission(member, guildId) {
  const cfg = await getOrCreateRoleConfig(guildId);
  const allowed = new Set([...(cfg?.hostersRoleIds || []), ...(cfg?.moderatorsRoleIds || [])]);
  const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasRole = member.roles.cache.some(r => allowed.has(r.id));
  return isAdmin || hasRole;
}

async function getWarChannel(guild, warId) {
  const war = await War.findById(warId);
  if (!war || !war.channelId) return { error: '⚠️ War channel not found.' };
  const channel = guild.channels.cache.get(war.channelId);
  if (!channel || channel.type !== ChannelType.GuildText) {
    return { error: '⚠️ This ticket has already been closed or the channel is invalid.' };
  }
  return { war, channel };
}

/**
 * Confirm and execute war ticket closure
 * CustomId: war:closeTicket:confirm:<warId>
 */
async function handle(interaction) {
  try {
    await interaction.deferUpdate();

    const [, , , warId] = interaction.customId.split(':');
    if (!warId) {
      return interaction.followUp({
        content: '❌ War ID not provided.',
        flags: MessageFlags.Ephemeral
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    if (!(await hasClosePermission(member, interaction.guild.id))) {
      return interaction.followUp({
        content: '❌ Only hosters, moderators or administrators can close the ticket.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { error, war, channel } = await getWarChannel(interaction.guild, warId);
    if (error) {
      return interaction.followUp({
        content: error,
        flags: MessageFlags.Ephemeral
      });
    }

    // Update war record
    war.closedByUserId = interaction.user.id;
    war.closedAt = new Date();
    await war.save();

    // Generate transcript before deleting the channel
    try {
      await interaction.followUp({
        content: '🧹 Closing this war ticket (generating transcript)...',
        flags: MessageFlags.Ephemeral
      });
    } catch (e) {
      const code = e?.code ?? e?.rawError?.code;
      if (code !== 10008) throw e; // rethrow unexpected errors
    }

    // Send transcript to logs with enhanced metadata
    try {
      await sendTranscriptToLogs(
        interaction.guild,
        channel,
        `War ${war._id} closed by ${interaction.user.tag}`,
        war
      );
    } catch (_) { }

    // Delete the channel
    try {
      await channel.delete('War ticket closed via button.');
    } catch (err) {
      try {
        await interaction.followUp({
          content: `❌ Could not close the ticket: ${err?.message || 'unknown error'}`,
          flags: MessageFlags.Ephemeral
        });
      } catch (e) {
        const code = e?.code ?? e?.rawError?.code;
        if (code !== 10008) throw e;
        LoggerService.error('Failed to delete war ticket channel:', { error: err?.message });
      }
      return;
    }

    try {
      await sendLog(
        interaction.guild,
        'War Ticket Closed',
        `War ${war._id} • Action by: <@${interaction.user.id}>`
      );
    } catch (_) { /* ignore */ }

    return;
  } catch (error) {
    LoggerService.error('Error confirming war ticket closure:', { error: error?.message });
    const msg = {
      content: '❌ Could not close the ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };

