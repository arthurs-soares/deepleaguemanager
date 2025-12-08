const { Events, ChannelType } = require('discord.js');
const { getOrCreateServerSettings } = require('../utils/system/serverSettings');
const { buildSupportCloseButtonRow } = require('../utils/tickets/closeButtons');
const LoggerService = require('../services/LoggerService');

module.exports = {
  name: Events.ThreadUpdate,
  once: false,

  /**
   * When a private support DM-fallback thread is reopened (unarchived), mention Support roles.
   * This helps bring staff back into the conversation after inactivity.
   * @param {import('discord.js').ThreadChannel} oldThread
   * @param {import('discord.js').ThreadChannel} newThread
   */
  async execute(oldThread, newThread) {
    try {
      // Only act on transitions from archived -> unarchived
      if (oldThread?.archived === false || newThread?.archived !== false) return;

      // Only handle private threads under the configured DM Warning channel
      if (!newThread || newThread.type !== ChannelType.PrivateThread) return;

      const guild = newThread.guild;
      if (!guild) return;

      const settings = await getOrCreateServerSettings(guild.id);
      if (!settings?.dmWarningChannelId) return;
      if (newThread.parentId !== settings.dmWarningChannelId) return;

      const components = [buildSupportCloseButtonRow()].filter(Boolean);

      const header = 'This DM support thread was reopened. Please take a look.';

      try { await newThread.send({ content: header, components }); } catch (_) { }
    } catch (err) {
      LoggerService.error('Error in ThreadUpdate handler:', { error: err?.message });
    }
  }
};

