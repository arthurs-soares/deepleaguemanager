const { MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { safeDeferEphemeral } = require('../core/ack');
const { replyEphemeral } = require('../core/reply');
const { isGuildAdmin } = require('../core/permissions');
const { auditAdminAction } = require('../misc/adminAudit');
const WarService = require('../../services/WarService');

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

  let result;
  try {
    result = await WarService.markDodge(warId, dodgerGuildName);
  } catch (error) {
    return replyEphemeral(interaction, { content: `❌ ${error.message}` });
  }

  const { war, dodger } = result;

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
  } catch (_) { }

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

  let result;
  try {
    result = await WarService.undoDodge(warId);
  } catch (error) {
    return replyEphemeral(interaction, { content: `❌ ${error.message}` });
  }

  const { war } = result;
  const beforeStatus = 'dodge'; // Known prior state for logging (simplified)

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
  } catch (_) { }

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

  let result;
  try {
    result = await WarService.revertResult(warId);
  } catch (error) {
    return replyEphemeral(interaction, { content: `❌ ${error.message}` });
  }

  const { war } = result;
  const beforeStatus = 'finalizada'; // Known prior state

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
  } catch (_) { }

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

