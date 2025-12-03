const { MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { safeDeferEphemeral } = require('../core/ack');
const { replyEphemeral } = require('../core/reply');
const { isGuildAdmin } = require('../core/permissions');
const { auditAdminAction } = require('../misc/adminAudit');
const Guild = require('../../models/guild/Guild');
const War = require('../../models/war/War');

/**
 * Build info container for responses
 * @param {string[]} lines - Content lines
 * @returns {ContainerBuilder}
 */
function buildInfoContainer(lines) {
  const container = new ContainerBuilder();
  const content = (lines || [])
    .filter(line => typeof line === 'string' && line.trim().length > 0)
    .join('\n');
  if (content.trim().length > 0) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );
  }
  return container;
}

async function markDodge(interaction) {
  await safeDeferEphemeral(interaction);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const allowed = await isGuildAdmin(member, interaction.guild.id);
  if (!allowed) {
    return replyEphemeral(interaction, { content: '❌ Admin/Moderator required.' });
  }

  const warId = interaction.options.getString('warid', true);
  const dodgerGuildName = interaction.options.getString('dodger_guild', true);
  const confirm = interaction.options.getBoolean('confirm', false) || false;
  if (!confirm) {
    return replyEphemeral(interaction, {
      content: '⚠️ Confirmation required. Re-run with confirm=true.'
    });
  }

  const war = await War.findById(warId);
  if (!war) {
    return replyEphemeral(interaction, { content: '❌ War not found.' });
  }
  if (war.status !== 'aberta') {
    return replyEphemeral(interaction, {
      content: '⚠️ War is not open for dodge.'
    });
  }

  const dodger = await Guild.findByName(dodgerGuildName, interaction.guild.id);
  if (!dodger) {
    return replyEphemeral(interaction, { content: '❌ Dodger guild not found.' });
  }

  war.status = 'dodge';
  war.dodgedByGuildId = dodger._id;
  await war.save();

  interaction._commandLogExtra = interaction._commandLogExtra || {};
  interaction._commandLogExtra.changes = [
    {
      entity: 'war',
      id: String(war._id),
      field: 'status',
      before: 'aberta',
      after: 'dodge',
      reason: 'admin dodge mark'
    }
  ];
  interaction._commandLogExtra.resultSummary =
    `War ${war._id} marked as dodge by ${dodger.name}`;
  try {
    await auditAdminAction(
      interaction.guild,
      interaction.user.id,
      'War Dodge Marked',
      { guildName: dodger.name, guildId: dodger._id, extra: `War ${war._id}` }
    );
  } catch (_) {}

  const container = buildInfoContainer([
    `✅ Marked war ${war._id} as Dodge`,
    `Dodger: ${dodger.name}`
  ]);
  return interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

async function undoDodge(interaction) {
  await safeDeferEphemeral(interaction);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const allowed = await isGuildAdmin(member, interaction.guild.id);
  if (!allowed) {
    return replyEphemeral(interaction, { content: '❌ Admin/Moderator required.' });
  }

  const warId = interaction.options.getString('warid', true);
  const confirm = interaction.options.getBoolean('confirm', false) || false;
  if (!confirm) {
    return replyEphemeral(interaction, {
      content: '⚠️ Confirmation required. Re-run with confirm=true.'
    });
  }

  const war = await War.findById(warId);
  if (!war) {
    return replyEphemeral(interaction, { content: '❌ War not found.' });
  }
  if (war.status !== 'dodge' || !war.dodgedByGuildId) {
    return replyEphemeral(interaction, {
      content: '⚠️ War is not in dodge state.'
    });
  }

  const beforeStatus = war.status;
  war.status = 'aberta';
  war.dodgedByGuildId = null;
  await war.save();

  interaction._commandLogExtra = interaction._commandLogExtra || {};
  interaction._commandLogExtra.changes = [
    {
      entity: 'war',
      id: String(war._id),
      field: 'status',
      before: beforeStatus,
      after: 'aberta',
      reason: 'admin dodge undo'
    }
  ];
  interaction._commandLogExtra.resultSummary =
    `War ${war._id} dodge reverted → open`;
  try {
    await auditAdminAction(
      interaction.guild,
      interaction.user.id,
      'War Dodge Reverted',
      { extra: `War ${war._id}` }
    );
  } catch (_) {}

  const container = buildInfoContainer([
    `✅ Reverted dodge for war ${war._id}`,
    'Status: aberta'
  ]);
  return interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

async function revertResult(interaction) {
  await safeDeferEphemeral(interaction);
  const member = await interaction.guild.members.fetch(interaction.user.id);
  const allowed = await isGuildAdmin(member, interaction.guild.id);
  if (!allowed) {
    return replyEphemeral(interaction, { content: '❌ Admin/Moderator required.' });
  }

  const warId = interaction.options.getString('warid', true);
  const confirm = interaction.options.getBoolean('confirm', false) || false;
  if (!confirm) {
    return replyEphemeral(interaction, {
      content: '⚠️ Confirmation required. Re-run with confirm=true.'
    });
  }

  const war = await War.findById(warId);
  if (!war) {
    return replyEphemeral(interaction, { content: '❌ War not found.' });
  }
  if (war.status !== 'finalizada' || !war.winnerGuildId) {
    return replyEphemeral(interaction, {
      content: '⚠️ War is not finalized or winner missing.'
    });
  }

  const winner = await Guild.findById(war.winnerGuildId);
  const loserId = String(war.winnerGuildId) === String(war.guildAId)
    ? war.guildBId
    : war.guildAId;
  const loser = await Guild.findById(loserId);
  if (!winner || !loser) {
    return replyEphemeral(interaction, { content: '❌ Guilds not found.' });
  }

  const winsPrev = Math.max(0, (winner.wins || 0) - 1);
  const lossesPrev = Math.max(0, (loser.losses || 0) - 1);

  winner.wins = winsPrev;
  loser.losses = lossesPrev;

  const beforeStatus = war.status;
  war.status = 'aberta';
  war.winnerGuildId = null;

  await Promise.all([winner.save(), loser.save(), war.save()]);

  interaction._commandLogExtra = interaction._commandLogExtra || {};
  interaction._commandLogExtra.changes = [
    {
      entity: 'war',
      id: String(war._id),
      field: 'status',
      before: beforeStatus,
      after: 'aberta',
      reason: 'war revert'
    }
  ];
  interaction._commandLogExtra.resultSummary =
    `Reverted war ${war._id} result → open`;
  try {
    await auditAdminAction(
      interaction.guild,
      interaction.user.id,
      'War Result Reverted',
      { extra: `War ${war._id}` }
    );
  } catch (_) {}

  const container = buildInfoContainer([
    `✅ Reverted result for war ${war._id}`,
    'Winner/Loser stats restored.'
  ]);
  return interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

module.exports = {
  markDodge,
  undoDodge,
  revertResult,
  buildInfoContainer,
};

