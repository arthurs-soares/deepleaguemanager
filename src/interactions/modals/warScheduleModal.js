// War schedule modal handler - creates war channels and confirmation
const { MessageFlags } = require('discord.js');
const War = require('../../models/war/War');
const Guild = require('../../models/guild/Guild');
const { getOrCreateServerSettings } = require('../../utils/system/serverSettings');
const { logWarCreated } = require('../../utils/misc/logEvents');
const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
const {
  validateDateParts,
  validateGuilds
} = require('../../utils/war/warValidation');
const {
  collectAllowedUsers,
  createWarChannel,
  findAvailableWarCategory
} = require('../../utils/war/channelManager');
const {
  createWarConfirmationEmbed,
  createWarConfirmationButtons
} = require('../../utils/war/warEmbedBuilder');
const { sendAndPin } = require('../../utils/tickets/pinUtils');
const LoggerService = require('../../services/LoggerService');

/** Max age (ms) before modal submission is skipped */
const MAX_AGE_MS = 2500;

/**
 * Handle war schedule modal submission
 * CustomId: war:scheduleModal:<guildAId>:<guildBId>:<region>
 */
async function handle(interaction) {
  try {
    // Early expiration check - must respond within 3s
    const age = Date.now() - interaction.createdTimestamp;
    if (age > MAX_AGE_MS) {
      LoggerService.warn('warScheduleModal skipped (expired)', { age });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const parts = interaction.customId.split(':');
    const guildAId = parts[2];
    const guildBId = parts[3];
    // Decode region (underscores back to spaces)
    const region = parts[4]?.replace(/_/g, ' ') || null;
    const day = interaction.fields.getTextInputValue('day');
    const month = interaction.fields.getTextInputValue('month');
    const time = interaction.fields.getTextInputValue('time');

    // Smart year selection: if date is in the past (based on month), assume next year
    const now = new Date();
    let year = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const inputMonth = parseInt(month, 10);

    // If input month is earlier than current month, assume user means next year
    // Example: Current is Dec (12), input is Jan (1) -> 2026
    if (!isNaN(inputMonth) && inputMonth < currentMonth) {
      year += 1;
    }

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

    if (!warRegion) {
      return interaction.editReply({
        content: '❌ Invalid region selected.'
      });
    }

    // Get server settings and find available war category (handling overflow)
    const settings = await getOrCreateServerSettings(interaction.guild.id);
    const { category, error } = await findAvailableWarCategory(
      interaction.guild,
      settings,
      warRegion
    );
    if (error) {
      return interaction.editReply({ content: error });
    }

    // Get role configuration
    const roleConfig = await getOrCreateRoleConfig(interaction.guild.id);
    const roleIdsHosters = roleConfig?.hostersRoleIds || [];

    // Collect allowed users and create channel
    const allowUserIds = collectAllowedUsers(guildA, guildB, interaction.user.id);
    const warChannel = await createWarChannel(
      interaction.guild,
      category,
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
      } catch (_) { }
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
    } catch (_) { }

    // Send confirmation
    await interaction.editReply({ content: `✅ Channel created: ${warChannel.toString()}` });
  } catch (error) {
    LoggerService.error('Error in warScheduleModal:', { error: error?.message });
    const msg = { content: '❌ Unable to schedule war.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

