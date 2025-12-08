/**
 * War Log MVP Select Handler
 * Handles user selection for MVP change
 * CustomId: wl:mvpSelect:<sessionId>
 */
const { MessageFlags } = require('discord.js');
const { warLogSessions } = require('../../services/warLog/sessionManager');
const { buildPreviewContainer } = require('../../utils/war/warLogContainer');
const { buildRoundButtons } = require('../../utils/war/warLogButtons');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle MVP user selection
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const sessionId = parts[2];

    const sessionData = warLogSessions.get(sessionId);
    if (!sessionData) {
      return interaction.reply({
        content: '❌ Session expired. Please use the command again.',
        flags: MessageFlags.Ephemeral
      });
    }

    const selectedUserId = interaction.values[0];
    sessionData.mvpId = selectedUserId;

    const header = `📝 Editing war log`;
    const container = buildPreviewContainer(sessionData, header);
    const buttonRows = buildRoundButtons(sessionId, sessionData.rounds.length, true);

    // Update the original edit message
    await interaction.message.delete().catch(() => { });

    // Find and update the original editor message
    const channel = interaction.channel;
    const messages = await channel.messages.fetch({ limit: 10 });
    const editorMsg = messages.find(m =>
      m.author.id === interaction.client.user.id &&
      m.interaction?.user?.id === interaction.user.id
    );

    if (editorMsg) {
      await editorMsg.edit({
        components: [container, ...buttonRows],
        flags: MessageFlags.IsComponentsV2
      });
    }

    await interaction.reply({
      content: `✅ MVP updated to <@${selectedUserId}>`,
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in warLogMvpSelect:', { error: error?.message });
    const msg = { content: '❌ Failed to update MVP.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
