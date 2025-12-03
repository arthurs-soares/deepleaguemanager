const { PermissionFlagsBits, MessageFlags } = require('discord.js');
const War = require('../../../models/war/War');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { isDatabaseConnected } = require('../../../config/database');
const LoggerService = require('../../../services/LoggerService');

/**
 * Claim a war ticket - only hosters can claim
 * Removes all hoster roles permission and grants only to the claimer
 * CustomId: war:claim:<warId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const [, , warId] = interaction.customId.split(':');
    if (!warId) {
      return interaction.editReply({ content: '❌ War ID not provided.' });
    }

    if (!isDatabaseConnected()) {
      return interaction.editReply({
        content: '❌ Database is temporarily unavailable.'
      });
    }

    let war = await War.findById(warId).catch(() => null);

    if (!war) {
      war = await War.findOne({
        discordGuildId: interaction.guild.id,
        channelId: interaction.channel.id,
        status: 'aberta'
      });
    }

    if (!war) {
      return interaction.editReply({ content: '❌ War not found.' });
    }

    if (war.status !== 'aberta') {
      return interaction.editReply({ content: '⚠️ This war is not open.' });
    }

    if (!war.acceptedAt) {
      return interaction.editReply({
        content: '⚠️ War must be accepted before claiming.'
      });
    }

    if (war.claimedByUserId) {
      return interaction.editReply({
        content: `⚠️ Already claimed by <@${war.claimedByUserId}>.`
      });
    }

    const cfg = await getOrCreateRoleConfig(interaction.guild.id);
    const hosterRoleIds = cfg?.hostersRoleIds || [];
    const member = await interaction.guild.members.fetch(interaction.user.id);
    const isHoster = member.roles.cache.some(r => hosterRoleIds.includes(r.id));
    const isAdmin = member.permissions?.has(PermissionFlagsBits.Administrator);

    if (!isHoster && !isAdmin) {
      return interaction.editReply({
        content: '❌ Only hosters can claim a ticket.'
      });
    }

    const channel = interaction.guild.channels.cache.get(war.channelId);
    if (!channel) {
      return interaction.editReply({ content: '❌ Channel not found.' });
    }

    // Remove permission for all hoster roles
    for (const roleId of hosterRoleIds) {
      const role = interaction.guild.roles.cache.get(roleId);
      if (role) {
        await channel.permissionOverwrites.edit(roleId, {
          ViewChannel: false,
          SendMessages: false,
          ReadMessageHistory: false
        }).catch(() => {});
      }
    }

    // Grant permission only to the claimer
    await channel.permissionOverwrites.edit(interaction.user.id, {
      ViewChannel: true,
      SendMessages: true,
      ReadMessageHistory: true,
      AttachFiles: true
    });

    war.claimedAt = new Date();
    war.claimedByUserId = interaction.user.id;
    await war.save();

    try {
      await channel.send({
        content: `🎫 Ticket claimed by <@${interaction.user.id}>.`,
        allowedMentions: { users: [interaction.user.id] }
      });
    } catch (_) {}

    return interaction.editReply({ content: '✅ Ticket claimed successfully.' });
  } catch (error) {
    LoggerService.error('Error in button war:claim:', error);
    const msg = {
      content: '❌ Could not claim the ticket.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
