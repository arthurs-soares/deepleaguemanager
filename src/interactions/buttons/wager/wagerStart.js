const { ActionRowBuilder, UserSelectMenuBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const LoggerService = require('../../../services/LoggerService');

/** Max age (ms) before button click is skipped */
const MAX_AGE_MS = 2500;

/**
 * Start wager challenge flow
 * CustomId: wager:start
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('wager:start skipped (expired)', { age });
      return;
    }

    const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');

    const roleCfg = await getOrCreateRoleConfig(interaction.guild.id);
    if (roleCfg.blacklistRoleIds?.some(id => interaction.member.roles.cache.has(id))) {
      return interaction.reply({
        content: '❌ You are blacklisted from using wager and war systems.',
        flags: MessageFlags.Ephemeral
      });
    }

    const descBase = 'Choose an opponent to open a wager ticket. A private channel will be created for coordination.';

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# Wager Challenge');

    const descText = new TextDisplayBuilder()
      .setContent(descBase);

    container.addTextDisplayComponents(titleText, descText);

    const select = new UserSelectMenuBuilder()
      .setCustomId('wager:selectOpponent')
      .setPlaceholder('Select the opponent user')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(select);
    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in wager:start button:', { error: error?.message });
    const msg = { content: '❌ Could not start wager flow.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

