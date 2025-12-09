const { PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ComponentType } = require('discord.js');
const { buildWarCloseButtonRow } = require('../../../utils/tickets/closeButtons');
const { replyEphemeral } = require('../../../utils/core/reply');
const War = require('../../../models/war/War');
const Guild = require('../../../models/guild/Guild');
const { sendLog } = require('../../../utils/core/logger');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const { getFirstActiveRegion } = require('../../../models/statics/guildStatics');
const LoggerService = require('../../../services/LoggerService');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors, emojis } = require('../../../config/botConfig');

/**
 * Disable buttons on the current interaction
 */
async function disableButtons(interaction) {
  const components = interaction.message.components.map(row => {
    if (row.type === ComponentType.ActionRow) {
      return ActionRowBuilder.from(row).setComponents(
        row.components.map(component =>
          ButtonBuilder.from(component).setDisabled(true)
        )
      );
    }
    return row;
  });
  await interaction.update({ components });
}

/**
 * Check if the user has permission to declare winner
 */
async function checkPermissions(interaction) {
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
  const allowedRoleIds = new Set([
    ...(rolesCfg?.hostersRoleIds || []),
    ...(rolesCfg?.moderatorsRoleIds || [])
  ]);

  const hasAdmin = member.permissions.has(PermissionFlagsBits.Administrator);
  const hasAllowedRole = member.roles.cache.some(r => allowedRoleIds.has(r.id));

  if (!hasAdmin && !hasAllowedRole) {
    await interaction.followUp({
      content: '❌ Only hosters, moderators or admins can declare.',
      flags: MessageFlags.Ephemeral
    });
    return false;
  }
  return true;
}

/**
 * Update the confirmation UI
 */
async function confirmWarResultUI(interaction) {
  try {
    const successColor = typeof colors.success === 'string'
      ? parseInt(colors.success.replace('#', ''), 16)
      : colors.success;

    const container = new ContainerBuilder()
      .setAccentColor(successColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.success} Result Confirmed`);

    const descText = new TextDisplayBuilder()
      .setContent(`Result confirmed by <@${interaction.user.id}>.`);

    container.addTextDisplayComponents(titleText, descText);

    await interaction.message.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (_) { /* Ignore UI update errors */ }
}

/**
 * Handle logging of the war result
 */
async function logWarResult(interaction, war, winner, loser, warRegion, guildA, guildB) {
  try {
    const freshWinner = await Guild.findById(winner._id);
    const freshLoser = await Guild.findById(loser._id);

    // Get region-specific stats for logging
    const winnerStats = freshWinner.regions?.find(r => r.region === warRegion);
    const loserStats = freshLoser.regions?.find(r => r.region === warRegion);

    const changes = [
      {
        entity: 'guild',
        id: String(freshWinner._id),
        field: `wins (${warRegion || 'unknown'})`,
        before: (winnerStats?.wins || 1) - 1,
        after: winnerStats?.wins || 0,
        reason: 'war win'
      },
      {
        entity: 'guild',
        id: String(freshLoser._id),
        field: `losses (${warRegion || 'unknown'})`,
        before: (loserStats?.losses || 1) - 1,
        after: loserStats?.losses || 0,
        reason: 'war loss'
      },
    ];
    interaction._commandLogExtra = interaction._commandLogExtra || {};
    interaction._commandLogExtra.changes =
      (interaction._commandLogExtra.changes || []).concat(changes);

    await sendLog(
      interaction.guild,
      'War finished',
      `War ${war._id}\nRegion: ${warRegion || 'N/A'}\n` +
      `Winner: ${winner.name}\n` +
      `Participants: ${guildA?.name} vs ${guildB?.name}`
    );
  } catch (_) { /* Ignore log errors */ }
}

/**
 * Confirm and execute war winner declaration
 * CustomId: war:declareWinner:confirm:<warId>:<winnerGuildId>
 */
async function handle(interaction) {
  try {
    await disableButtons(interaction);

    const authorized = await checkPermissions(interaction);
    if (!authorized) return;



    const [, , , warId, winnerGuildId] = interaction.customId.split(':');
    const war = await War.findById(warId);
    if (!war || war.status !== 'aberta') {
      return interaction.followUp({
        content: '⚠️ Invalid war or already finished.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [guildA, guildB, winner] = await Promise.all([
      Guild.findById(war.guildAId),
      Guild.findById(war.guildBId),
      Guild.findById(winnerGuildId),
    ]);

    if (!winner) {
      return interaction.followUp({
        content: '❌ Invalid winner guild.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Update stats
    // We already have the guild objects from the initial fetch
    const loser = String(winner._id) === String(guildA._id) ? guildB : guildA;

    // We already have the guild objects from the initial fetch


    // Determine the region for this war
    const warRegion = war.region ||
      getFirstActiveRegion(winner)?.region ||
      getFirstActiveRegion(loser)?.region;

    if (warRegion) {
      // Update region-specific stats
      const winnerRegionStats = winner.regions?.find(
        r => r.region === warRegion
      );
      const loserRegionStats = loser.regions?.find(
        r => r.region === warRegion
      );

      if (winnerRegionStats) {
        winnerRegionStats.wins = (winnerRegionStats.wins || 0) + 1;
      }
      if (loserRegionStats) {
        loserRegionStats.losses = (loserRegionStats.losses || 0) + 1;
      }
    }

    war.status = 'finalizada';
    war.winnerGuildId = winner._id;

    await Promise.all([winner.save(), loser.save(), war.save()]);

    await confirmWarResultUI(interaction);

    // Post to channel
    try {
      await interaction.channel.send({
        content: `🏆 Winner declared: **${winner.name}**`,
        components: [buildWarCloseButtonRow(war._id)]
      });
    } catch (_) { }

    await logWarResult(interaction, war, winner, loser, warRegion, guildA, guildB);

    return interaction.followUp({
      content: '✅ Result saved successfully.',
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error confirming winner:', error);
    return replyEphemeral(interaction, {
      content: '❌ Could not save the result.'
    });
  }
}

module.exports = { handle };
