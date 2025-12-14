const { ChannelType, MessageFlags } = require('discord.js');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { sendTranscriptToLogs } = require('../../../utils/tickets/transcript');
const { sendLog } = require('../../../utils/core/logger');
const { buildWarDodgeEmbed } = require('../../../utils/embeds/warDodgeEmbed');
const { sendWarDodgeLog } = require('../../../utils/tickets/warDodgeLog');
const LoggerService = require('../../../services/LoggerService');
const UserProfile = require('../../../models/user/UserProfile');


/**
 * Apply the war dodge after confirmation
 * CustomId: war:dodge:apply:<warId>:<dodgerGuildId>:<sourceMessageId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const warId = parts[3];
    const dodgerGuildId = parts[4];
    const sourceMessageId = parts[5] && parts[5] !== '0' ? parts[5] : null;

    if (!warId || !dodgerGuildId) {
      return interaction.editReply({ content: '❌ Invalid parameters.' });
    }

    // Permissions: only Moderators/Hosters (configured in /config)
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([
      ...(rolesCfg?.hostersRoleIds || []),
      ...(rolesCfg?.moderatorsRoleIds || [])
    ]);
    const hasAllowedRole = interaction.member.roles.cache
      .some(r => allowedRoleIds.has(r.id));
    if (!hasAllowedRole) {
      return interaction.editReply({
        content: '❌ Only hosters or moderators can mark a war as dodge.'
      });
    }

    const war = await War.findById(warId);
    if (!war) {
      return interaction.editReply({ content: '❌ War not found.' });
    }
    if (war.status !== 'aberta') {
      return interaction.editReply({
        content: '⚠️ This war is no longer waiting for confirmation.'
      });
    }

    const [guildA, guildB] = await Promise.all([
      Guild.findById(war.guildAId),
      Guild.findById(war.guildBId)
    ]);

    war.status = 'dodge';
    war.dodgedByGuildId = dodgerGuildId;
    await war.save();

    // Update hoster stats
    await UserProfile.updateOne(
      { discordUserId: interaction.user.id },
      { $inc: { hostedDodges: 1 } },
      { upsert: true }
    ).catch(err => LoggerService.warn('Failed to update hoster stats:', { error: err?.message }));

    // Clean original panel and notify in war channel
    try {
      const warChannel = war.channelId
        ? interaction.guild.channels.cache.get(war.channelId)
        : null;
      if (warChannel && sourceMessageId) {
        try {
          const msg = await warChannel.messages
            .fetch(sourceMessageId).catch(() => null);
          if (msg) await msg.edit({ components: [] }).catch(() => { });
        } catch (_) { }
      }
      if (warChannel && warChannel.type === ChannelType.GuildText) {
        const dodgerName = String(dodgerGuildId) === String(war.guildAId)
          ? (guildA?.name || 'Guild A')
          : (guildB?.name || 'Guild B');
        const opponentName = String(dodgerGuildId) === String(war.guildAId)
          ? (guildB?.name || 'Guild B')
          : (guildA?.name || 'Guild A');
        const embed = buildWarDodgeEmbed(
          dodgerName, opponentName, interaction.user.id, null, new Date()
        );
        await warChannel.send({
          components: [embed],
          flags: MessageFlags.IsComponentsV2
        });
        try {
          await sendTranscriptToLogs(
            interaction.guild,
            warChannel,
            `War ${war._id} marked as dodge by ${dodgerName}` +
            ` (by <@${interaction.user.id}>)`,
            war
          );
        } catch (_) { }
      }
    } catch (_) { }

    // Log + notification
    try {
      const dodgerName = String(dodgerGuildId) === String(war.guildAId)
        ? (guildA?.name || 'Guild A')
        : (guildB?.name || 'Guild B');
      const opponentName = String(dodgerGuildId) === String(war.guildAId)
        ? (guildB?.name || 'Guild B')
        : (guildA?.name || 'Guild A');
      await sendLog(
        interaction.guild,
        'War Dodge',
        `War ${war._id}: ${dodgerName} dodged vs ${opponentName}. ` +
        `By <@${interaction.user.id}>.`
      );

      // Send to configured war dodge channel
      await sendWarDodgeLog(
        interaction.guild,
        dodgerName,
        opponentName,
        interaction.user.id
      );
    } catch (_) { }

    try {
      return await interaction.editReply({ content: '✅ Dodge recorded.' });
    } catch (e) {
      const code = e?.code ?? e?.rawError?.code;
      if (code !== 10008) throw e;
      return;
    }
  } catch (error) {
    const LoggerService = require('../../../services/LoggerService');
    LoggerService.error('Error in button war:dodge:apply:', {
      error: error?.message
    });
    const msg = { content: '❌ Could not apply the dodge.' };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({ ...msg, ephemeral: true });
    }
    return interaction.reply({ ...msg, ephemeral: true });
  }
}

module.exports = { handle };

