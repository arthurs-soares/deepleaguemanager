const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags } = require('discord.js');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens modal to input date and time
 * CustomId: war:openScheduleModal:<guildAId>:<guildBId>:<region>
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const guildAId = parts[2];
    const guildBId = parts[3];
    const region = parts[4] || '';
    if (!guildAId || !guildBId) return interaction.deferUpdate();

    const modal = new ModalBuilder()
      .setCustomId(`war:scheduleModal:${guildAId}:${guildBId}:${region}`)
      .setTitle('Schedule War');

    const dayInput = new TextInputBuilder()
      .setCustomId('day')
      .setLabel('Day (1-31)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('DD')
      .setMinLength(1)
      .setMaxLength(2);

    const monthInput = new TextInputBuilder()
      .setCustomId('month')
      .setLabel('Month (1-12)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('MM')
      .setMinLength(1)
      .setMaxLength(2);

    const yearInput = new TextInputBuilder()
      .setCustomId('year')
      .setLabel('Year (e.g., 2025)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('YYYY')
      .setMinLength(4)
      .setMaxLength(4);

    const timeInput = new TextInputBuilder()
      .setCustomId('time')
      .setLabel('Time (HH:mm, 24-hour)')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setPlaceholder('HH:mm')
      .setMinLength(4)
      .setMaxLength(5);

    modal.addComponents(
      new ActionRowBuilder().addComponents(dayInput),
      new ActionRowBuilder().addComponents(monthInput),
      new ActionRowBuilder().addComponents(yearInput),
      new ActionRowBuilder().addComponents(timeInput),
    );

    return interaction.showModal(modal);
  } catch (error) {
    LoggerService.error('Error in war:openScheduleModal button:', { error: error?.message });
    const msg = { content: '❌ Could not open the modal.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

