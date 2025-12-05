const { MessageFlags } = require('discord.js');
const {
  createErrorEmbed,
  createSuccessEmbed
} = require('../../../utils/embeds/embedBuilder');
const { addToRoster, getGuildById } = require('../../../utils/roster/rosterManager');
const { notifyInviterOnAccept } = require('../../../utils/roster/notifyInviterOnAccept');
const { safeDeferEphemeral } = require('../../../utils/core/ack');


/**
 * Button handler for accepting a roster invitation via DM
 * CustomId: rosterInvite:accept:<guildId>:<roster>:<inviterId>:<region>
 */
async function handle(interaction) {
  try {
    await safeDeferEphemeral(interaction);

    const parts = interaction.customId.split(':');
    const guildId = parts[2];
    const roster = parts[3] === 'main' ? 'main' : 'sub';
    const inviterId = parts[4] || null;
    // Decode region (underscores back to spaces)
    const region = parts[5]?.replace(/_/g, ' ');

    if (!guildId || !region) {
      const embed = createErrorEmbed('Invalid invitation', 'Missing data.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const guildDoc = await getGuildById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild no longer exists.');
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const userId = interaction.user.id;

    // Add to roster with region
    const result = await addToRoster(
      guildId,
      roster,
      userId,
      region,
      interaction.client
    );

    if (!result.success) {
      const msg = result.message || 'Could not add you to the roster.';
      const embed = createErrorEmbed('Could not join', msg);
      return interaction.editReply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    const rosterLabel = roster === 'main' ? 'Main Roster' : 'Sub Roster';
    const container = createSuccessEmbed(
      'You have joined the guild',
      `Added to ${rosterLabel} of "${result.guild?.name || guildDoc.name}" ` +
      `for region **${region}**. Welcome!`
    );

    // Notify inviter
    if (inviterId) {
      const acceptedUsername = interaction.user.tag || interaction.user.username;
      await notifyInviterOnAccept(interaction.client, inviterId, {
        acceptedUserId: interaction.user.id,
        acceptedUsername,
        guildName: result.guild?.name || guildDoc.name,
        roster,
        region,
        when: new Date(),
        discordGuildId: guildDoc.discordGuildId || interaction.guild?.id,
      }).catch(() => {});
    }

    try {
      await interaction.message.edit({ components: [] });
    } catch (_) {}

    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  } catch (error) {
    const container = createErrorEmbed('Error', 'Error processing acceptance.');
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };

