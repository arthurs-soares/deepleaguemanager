const { MessageFlags } = require('discord.js');
const { updateUserProfile } = require('../../utils/user/userProfile');
const LoggerService = require('../../services/LoggerService');

/**
 * Saves profile changes while preserving unspecified fields
 * CustomId: profile:editModal
 */
async function handle(interaction) {
  try {

    const rawBanner = (interaction.fields.getTextInputValue('bannerUrl') || '').trim();
    const rawColor = (interaction.fields.getTextInputValue('color') || '').trim();
    const rawDesc = (interaction.fields.getTextInputValue('description') || '').trim();

    const update = {};

    // Banner URL: only update if provided (not empty)
    if (rawBanner !== '') {
      if (rawBanner && !/^https?:\/\//i.test(rawBanner)) {
        return interaction.reply({
          content: '❌ Invalid banner URL. Use http(s)://',
          flags: MessageFlags.Ephemeral
        });
      }
      update.bannerUrl = rawBanner || null;
    }

    // Color: normalize to #RRGGBB if provided
    if (rawColor !== '') {
      let color = rawColor;
      if (color && !color.startsWith('#')) color = `#${color}`;
      if (color && !/^#[0-9a-fA-F]{6}$/.test(color)) {
        return interaction.reply({
          content: '❌ Invalid color. Use a 6-digit hex (e.g., #FFAA00).',
          flags: MessageFlags.Ephemeral
        });
      }
      update.color = color || null;
    }

    // Description: only update if provided (can clear if explicitly empty)
    if (rawDesc !== '') {
      update.description = rawDesc;
    }

    // If nothing to update, just confirm
    if (Object.keys(update).length === 0) {
      return interaction.reply({
        content: 'ℹ️ Nothing to update.',
        flags: MessageFlags.Ephemeral
      });
    }

    await updateUserProfile(interaction.user.id, update);

    return interaction.reply({
      content: '✅ Profile updated successfully!',
      flags: MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error saving profile:', { error: error?.message });
    const msg = { content: '❌ Could not save your profile.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

