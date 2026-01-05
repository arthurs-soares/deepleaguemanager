const configChannelSelect = require('./configChannelSelect');
/**
 * Handle secondary channel configuration dropdown selection
 * CustomId: config:channels:select_2
 * Redirects to the main handler logic
 */
async function handle(interaction) {
  return configChannelSelect.handle(interaction);
}

module.exports = { handle };
