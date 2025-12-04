const { MessageFlags } = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { colors, emojis } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');
const { warLogSessions } = require('../../../commands/admin/log');
const WarLog = require('../../../models/war/WarLog');

/**
 * Handle submit button - sends final war log to channel
 * CustomId: wl:s:<sessionId>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const sessionId = interaction.customId.split(':')[2];
    const sessionData = warLogSessions.get(sessionId);

    if (!sessionData) {
      return interaction.editReply({
        content: '❌ Session expired. Please use the command again.'
      });
    }

    if (sessionData.rounds.length < 2) {
      return interaction.editReply({
        content: '❌ You need at least 2 rounds to submit.'
      });
    }

    // Get war logs channel
    const settings = await getOrCreateServerSettings(interaction.guild.id);
    if (!settings.warLogsChannelId) {
      return interaction.editReply({
        content: '❌ War logs channel not configured. Use /config → Channels.'
      });
    }

    const logsChannel = interaction.guild.channels.cache.get(
      settings.warLogsChannelId
    );
    if (!logsChannel) {
      return interaction.editReply({
        content: '❌ War logs channel not found or inaccessible.'
      });
    }

    // Handle edit vs new log
    if (sessionData.isEdit) {
      return handleEditSubmit(interaction, sessionData, logsChannel, sessionId);
    }

    return handleNewSubmit(interaction, sessionData, logsChannel, sessionId);
  } catch (error) {
    LoggerService.error('Error in warLogSubmit:', { error: error.message });
    const msg = { content: '❌ Unable to submit war log.' };
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(msg);
    }
    return interaction.reply({ ...msg, flags: MessageFlags.Ephemeral });
  }
}

/**
 * Handle new war log submission
 */
async function handleNewSubmit(interaction, sessionData, logsChannel, sessionId) {
  // Create war log in database first to get the ID
  const warLog = await WarLog.create({
    discordGuildId: interaction.guild.id,
    messageId: 'pending',
    channelId: logsChannel.id,
    guildA: sessionData.guildA,
    guildB: sessionData.guildB,
    format: sessionData.format,
    mvpId: sessionData.mvpId,
    honorableId: sessionData.honorableId || null,
    rounds: sessionData.rounds,
    createdByUserId: interaction.user.id
  });

  // Build final container with log ID in footer
  const container = buildFinalContainer(sessionData, warLog._id.toString());

  const sentMessage = await logsChannel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  // Update war log with message ID
  warLog.messageId = sentMessage.id;
  await warLog.save();

  // Clean up session
  warLogSessions.delete(sessionId);

  return interaction.editReply({
    content: `✅ War log sent to <#${logsChannel.id}>.\nLog ID: \`${warLog._id}\``
  });
}

/**
 * Handle edit war log submission
 */
async function handleEditSubmit(interaction, sessionData, logsChannel, sessionId) {
  // Update the existing war log
  const warLog = await WarLog.findByIdAndUpdate(
    sessionData.originalLogId,
    {
      guildA: sessionData.guildA,
      guildB: sessionData.guildB,
      format: sessionData.format,
      mvpId: sessionData.mvpId,
      honorableId: sessionData.honorableId || null,
      rounds: sessionData.rounds,
      updatedByUserId: interaction.user.id
    },
    { new: true }
  );

  if (!warLog) {
    return interaction.editReply({
      content: '❌ War log not found in database.'
    });
  }

  // Build updated container
  const container = buildFinalContainer(sessionData, warLog._id.toString());

  // Edit the original message
  try {
    const message = await logsChannel.messages.fetch(sessionData.messageId);
    await message.edit({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch {
    return interaction.editReply({
      content: '❌ Could not edit original message. It may have been deleted.'
    });
  }

  // Clean up session
  warLogSessions.delete(sessionId);

  return interaction.editReply({
    content: `✅ War log updated successfully.\nLog ID: \`${warLog._id}\``
  });
}

/**
 * Build final war log container with log ID in footer
 * @param {Object} data - Session data
 * @param {string} logId - War log database ID
 */
function buildFinalContainer(data, logId) {
  const { guildA, guildB, format, mvpId, honorableId, rounds } = data;

  const container = new ContainerBuilder();
  const primaryColor = typeof colors.primary === 'string'
    ? parseInt(colors.primary.replace('#', ''), 16)
    : colors.primary;
  container.setAccentColor(primaryColor);

  const titleText = new TextDisplayBuilder()
    .setContent(`# ${guildA} vs ${guildB}`);
  const formatText = new TextDisplayBuilder()
    .setContent(`${format} war`);

  container.addTextDisplayComponents(titleText, formatText);
  container.addSeparatorComponents(new SeparatorBuilder());

  // Round results
  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i];
    const winner = getRoundWinner(round, guildA, guildB);

    let content = `## Round ${i + 1}\n` +
      `${guildA}: ${round.deathsA} Deaths\n` +
      `${guildB}: ${round.deathsB} Deaths`;

    if (round.clip) {
      content += `\n🎬 [Clip](${round.clip})`;
    }

    content += `\n**${winner} WINS** ⚔️`;

    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(content)
    );

    if (i < rounds.length - 1) {
      container.addSeparatorComponents(new SeparatorBuilder());
    }
  }

  container.addSeparatorComponents(new SeparatorBuilder());

  // Overall winner
  const overallWinner = getOverallWinner(rounds, guildA, guildB);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`## **${overallWinner} WINS** ${emojis.swords}`)
  );

  // MVP
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**MVP:** <@${mvpId}>`)
  );

  // Honorable mention
  if (honorableId) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`Honorable Mention: <@${honorableId}>`)
    );
  }

  // Footer with log ID for editing
  container.addSeparatorComponents(new SeparatorBuilder());
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`-# Log ID: ${logId}`)
  );

  return container;
}

function getRoundWinner(round, guildA, guildB) {
  if (round.deathsA < round.deathsB) return guildA;
  if (round.deathsB < round.deathsA) return guildB;
  return 'Tie';
}

function getOverallWinner(rounds, guildA, guildB) {
  let winsA = 0, winsB = 0;
  for (const r of rounds) {
    if (r.deathsA < r.deathsB) winsA++;
    else if (r.deathsB < r.deathsA) winsB++;
  }
  if (winsA > winsB) return guildA;
  if (winsB > winsA) return guildB;
  return 'Tie';
}

module.exports = { handle };
