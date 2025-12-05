const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags
} = require('discord.js');
const Guild = require('../../../models/guild/Guild');
const {
  isUserInAnyGuildRoster
} = require('../../../utils/roster/rosterManager');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens confirmation to leave the guild
 * If user is in multiple regions, shows region selector first
 * CustomId: profile:leaveGuild
 */
async function handle(interaction) {
  try {
    const doc = await Guild.findOne({
      discordGuildId: interaction.guild.id,
      $or: [
        { members: { $elemMatch: { userId: interaction.user.id } } },
        { 'regions.mainRoster': interaction.user.id },
        { 'regions.subRoster': interaction.user.id },
      ]
    });

    if (!doc) {
      return interaction.reply({
        content: '⚠️ You are not in any registered guild.',
        flags: MessageFlags.Ephemeral
      });
    }

    const { regions } = isUserInAnyGuildRoster(doc, interaction.user.id);
    const validRegions = regions.filter(r => r !== 'legacy');

    if (validRegions.length > 1) {
      const options = validRegions.map(region => ({
        label: region,
        description: `Leave roster for ${region}`,
        value: region
      }));

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`profile:leaveGuild:selectRegion:${doc._id}`)
        .setPlaceholder('Select region to leave')
        .addOptions(options);

      const row = new ActionRowBuilder().addComponents(menu);
      return interaction.reply({
        content: '📍 You are in rosters for multiple regions. Select which one:',
        components: [row],
        flags: MessageFlags.Ephemeral
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('profile:confirmLeave:yes')
        .setStyle(ButtonStyle.Danger)
        .setLabel('Confirm Leave'),
      new ButtonBuilder()
        .setCustomId('profile:confirmLeave:no')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Cancel')
    );

    return interaction.reply({
      content: '⚠️ Are you sure you want to leave your guild?',
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error opening leave guild confirmation:', {
      error: error.message
    });
    const msg = {
      content: '❌ Could not open the confirmation.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
