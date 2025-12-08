const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { getOrCreateUserProfile } = require('../../../utils/user/userProfile');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens profile editing modal
 * CustomId: profile:edit
 */
async function handle(interaction) {
  try {
    if (interaction.user.id !== interaction.member.user.id) {
      return interaction.reply({ content: '❌ You can only edit your own profile.', ephemeral: true });
    }

    const profile = await getOrCreateUserProfile(interaction.user.id);

    const modal = new ModalBuilder()
      .setCustomId('profile:editModal')
      .setTitle('Edit Profile');

    const banner = new TextInputBuilder()
      .setCustomId('bannerUrl')
      .setLabel('Banner URL (optional)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(profile.bannerUrl || '');

    const color = new TextInputBuilder()
      .setCustomId('color')
      .setLabel('Embed color (hex, ex: #00AAFF)')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setValue(profile.color || '');

    const desc = new TextInputBuilder()
      .setCustomId('description')
      .setLabel('Profile description')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(false)
      .setValue(profile.description || '');

    modal.addComponents(
      new ActionRowBuilder().addComponents(banner),
      new ActionRowBuilder().addComponents(color),
      new ActionRowBuilder().addComponents(desc)
    );

    return interaction.showModal(modal);
  } catch (error) {
    LoggerService.error('Error opening profile edit modal:', { error: error?.message });
    const msg = { content: '❌ Could not open the modal.', ephemeral: true };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
