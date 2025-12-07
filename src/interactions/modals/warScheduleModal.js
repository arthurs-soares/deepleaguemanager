// War schedule modal handler - creates war channels and confirmation
const { MessageFlags } = require('discord.js');
const War = require('../../models/war/War');
const Guild = require('../../models/guild/Guild');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { logWarCreated } = require('../../utils/misc/logEvents');
const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
const { validateDateParts, validateGuilds, validateWarCategory } = require('../../utils/war/warValidation');
const { collectAllowedUsers, createWarChannel } = require('../../utils/war/channelManager');
const { createWarConfirmationEmbed, createWarConfirmationButtons } = require('../../utils/war/warEmbedBuilder');
const { sendAndPin } = require('../../utils/tickets/pinUtils');

/**
 * Handle war schedule modal submission
 * CustomId: war:scheduleModal:<guildAId>:<guildBId>:<region>
 */
async function handle(interaction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const guildAId = parts[2];
    const guildBId = parts[3];
    // Decode region (underscores back to spaces)
    const region = parts[4]?.replace(/_/g, ' ') || null;
    const day = interaction.fields.getTextInputValue('day');
    const month = interaction.fields.getTextInputValue('month');
    const year = interaction.fields.getTextInputValue('year');
    const time = interaction.fields.getTextInputValue('time');

    // Validate date/time input (must be in the future)
    const dateTimeValidation = validateDateParts(day, month, year, time);
    if (!dateTimeValidation.valid) {
      return interaction.editReply({ content: dateTimeValidation.message });
    }

    // Fetch guild documents
    const [guildA, guildB] = await Promise.all([
      Guild.findById(guildAId),
      Guild.findById(guildBId)
    ]);

    // Validate guilds
    const guildValidation = validateGuilds(guildA, guildB);
    if (!guildValidation.valid) {
      return interaction.editReply({ content: guildValidation.message });
    }

    // Determine war region (from customId - guildA's selected region)
    let warRegion = region;
    if (!warRegion) {
      // Fallback: use guildA's first active region
      const regionsA = (guildA.regions || [])
        .filter(r => r.status === 'active')
        .map(r => r.region);
      warRegion = regionsA[0] || null;
    }

    // Validate guildA is active in the selected war region
    const guildAInRegion = guildA.regions?.some(
      r => r.region === warRegion && r.status === 'active'
    );

    if (!warRegion || !guildAInRegion) {
      return interaction.editReply({
        content: '❌ Your guild must be active in the selected region.'
      });
    }

    // Get server settings and validate war category for the region
    const settings = await getOrCreateServerSettings(interaction.guild.id);
    const categoryValidation = await validateWarCategory(
      settings,
      interaction.guild,
      warRegion
    );
    if (!categoryValidation.valid) {
      return interaction.editReply({ content: categoryValidation.message });
    }

    // Get role configuration
    const roleConfig = await getOrCreateRoleConfig(interaction.guild.id);
    const roleIdsHosters = roleConfig?.hostersRoleIds || [];

    // Collect allowed users and create channel
    const allowUserIds = collectAllowedUsers(guildA, guildB, interaction.user.id);
    const warChannel = await createWarChannel(
      interaction.guild,
      categoryValidation.category,
      guildA,
      guildB,
      allowUserIds,
      roleIdsHosters
    );

    // Create war record in database with region
    const war = await War.create({
      discordGuildId: interaction.guild.id,
      guildAId: guildA._id,
      guildBId: guildB._id,
      region: warRegion,
      scheduledAt: dateTimeValidation.dateTime,
      channelId: warChannel.id,
      requestedByGuildId: guildA._id,
    });

    // Notify allowed users
    const mentionList = Array.from(allowUserIds).map(id => `<@${id}>`).join(' ');
    if (mentionList) {
      try {
        await warChannel.send({ content: `👥 Access granted: ${mentionList}` });
      } catch (_) {}
    }

    // Note: Hosters are NOT mentioned on war creation
    // They will be mentioned only when the war is accepted by clicking the "Accept" button

    // Create and send confirmation embed (Components v2)
    const { embed } = await createWarConfirmationEmbed(guildA, guildB, dateTimeValidation.dateTime, interaction.guild);
    const confirmRow = createWarConfirmationButtons(war._id);
    await sendAndPin(warChannel, {
      components: [embed, confirmRow],
      flags: MessageFlags.IsComponentsV2
    }, { unpinOld: false });

    // Log war creation
    try {
      await logWarCreated(war, guildA.name, guildB.name, interaction.guild);
    } catch (_) {}

    // Send confirmation
    await interaction.editReply({ content: `✅ Channel created: ${warChannel.toString()}` });
  } catch (error) {
    console.error('Error in warScheduleModal:', error);
    const msg = { content: '❌ Unable to schedule war.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

