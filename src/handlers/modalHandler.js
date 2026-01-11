const { createErrorEmbed } = require('../utils/embeds/embedBuilder');
const { replyEphemeral } = require('../utils/core/reply');
const LoggerService = require('../services/LoggerService');

/**
 * Routes Modal Submit interactions to their respective handlers
 * @param {ModalSubmitInteraction} interaction
 */
async function handleModalInteraction(interaction) {
  try {
    const { customId } = interaction;

    if (customId.startsWith('guild_edit_data_modal:')) {
      const handler = require('../interactions/modals/editGuildDataModal');
      return handler.handle(interaction);
    }

    if (customId.startsWith('war:scheduleModal:')) {
      const handler = require('../interactions/modals/warScheduleModal');
      return handler.handle(interaction);
    }

    if (customId.startsWith('war:opponentModal:')) {
      const handler = require('../interactions/modals/warOpponentModal');
      return handler.handle(interaction);
    }

    if (customId === 'profile:editModal') {
      const handler = require('../interactions/modals/editProfileModal');
      return handler.handle(interaction);
    }

    if (customId.startsWith('wl:rm:')) {
      const handler = require('../interactions/modals/warLogModal');
      return handler.handle(interaction);
    }

    // No known route, ignore
  } catch (error) {
    LoggerService.error('Error in handleModalInteraction:', {
      error: error?.message
    });

    const embed = createErrorEmbed(
      'Interaction Error',
      'An error occurred while processing this form.'
    );

    await replyEphemeral(interaction, { components: [embed] });
  }
}

module.exports = { handleModalInteraction };

