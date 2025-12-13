const {
  ActionRowBuilder,
  UserSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder
} = require('@discordjs/builders');
const { colors, emojis } = require('../../../config/botConfig');

/**
 * Start 2v2 wager challenge flow
 * CustomId: wager:start2v2
 */
async function handle(interaction) {
  try {
    const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
    const roleCfg = await getOrCreateRoleConfig(interaction.guild.id);
    if (roleCfg.blacklistRoleIds?.some(id => interaction.member.roles.cache.has(id))) {
      return interaction.reply({
        content: '❌ You are blacklisted from using wager and war systems.',
        flags: MessageFlags.Ephemeral
      });
    }

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.depthsWager} 2v2 Wager Challenge`);

    const descText = new TextDisplayBuilder()
      .setContent(
        '**Step 1/2:** Select your teammate\n\n' +
        'Choose a friend to team up with for this 2v2 wager.'
      );

    container.addTextDisplayComponents(titleText, descText);

    const select = new UserSelectMenuBuilder()
      .setCustomId('wager:select2v2Teammate')
      .setPlaceholder('Select your teammate')
      .setMinValues(1)
      .setMaxValues(1);

    const row = new ActionRowBuilder().addComponents(select);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    const LoggerService = require('../../../services/LoggerService');
    LoggerService.error('Error in wager:start2v2 button:', error);
    const msg = {
      content: '❌ Could not start 2v2 wager flow.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
