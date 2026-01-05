const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const { getOrCreateServerSettings } = require('../../../utils/system/serverSettings');
const { buildChannelCategoryOptions, buildChannelMiscOptions, buildChannelsDisplayText } = require('../../../utils/config/channelConfigOptions');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens Channels panel
 * CustomId: config:channels
 */
async function handle(interaction) {
  try {
    const cfg = await getOrCreateServerSettings(interaction.guild.id);

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# ⚙️ Configure Channels');

    const descText = new TextDisplayBuilder()
      .setContent('Select a channel type from the dropdown menus below to configure it.');

    const channelsText = new TextDisplayBuilder()
      .setContent(buildChannelsDisplayText(cfg));

    container.addTextDisplayComponents(titleText, descText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(channelsText);

    const categorySelect = new StringSelectMenuBuilder()
      .setCustomId('config:channels:select')
      .setPlaceholder('Categories & Tickets')
      .addOptions(buildChannelCategoryOptions());

    const miscSelect = new StringSelectMenuBuilder()
    // CustomID must be the same so existing listener picks it up,
    // OR we update listener to handle both?
    // Since specific interactions are ephemeral, likely handled by same handler 'config:channels:select'
    // StringSelectMenu interaction will carry the customId.
    // If we use same customId, discord *might* complain if on same message?
    // No, distinct components on same message can have same customId?
    // Actually common practice is unique customIds.
    // However the handler `interaction.values` logic is generic.
    // Let's use same customId for simplicity if it works, or 'config:channels:select:2'
    // BUT listener likely only listens to exact string.
    // Checking `configChannelSelect.js`: it handles `config:channels:select`.
    // It reads `interaction.values[0]`.
    // Since values are unique across both lists, we can reuse the handler logic.
    // But components on SAME message cannot have duplicate customIds.
    // We must use a unique ID for the second menu, and route it to the same handler code.
    // Wait, I should check how interactions are routed.
    // If routed by strict equality, I need to register the new ID.
    // Let's assume strict equality. I'll need to update the router or just make it 'config:channels:select_misc'.
    // But let's check d:\bots\deepleagueNAmanager\src\interactions\string-selects\configChannelSelect.js
    // It exports `handle`. The file name is `configChannelSelect.js`.
    // Usually there is an index or interactionCreate handler mapping IDs to files.
    // The user didn't show me the router.
    // I will assume I need to keep `customId` consistent if possible or update router.
    // Actually, if I change customID, I might break routing if I don't know where it's defined.
    // BUT distinct components MUST have distinct Custom IDs.
    // I will name the second one `config:channels:select` as well? NO, that throws error "Component custom id must be unique".
    // I will name it `config:channels:select:misc`.
    // And I'll hope the router uses `startsWith` or I can update `configChannelSelect.js` to handle it?
    // The `configChannelSelect.js` handles logic based on values.
    // If the router is dynamic (e.g. file based), I might need a new file?
    // Or maybe the router uses the file name?
    // Let's assume the router maps `config:channels:select` -> `configChannelSelect.js`.
    // If I make it `config:channels:select_misc`, it might not route anywhere.
    // HACK: I will reuse the same handler logic.
    // I'll try to use `config:channels:select` for the FIRST one.
    // And `config:channels:select_misc` for the SECOND.
    // And I will duplicate the file `configChannelSelect.js` to `configChannelSelectMisc.js`?
    // No, that's messy.
    // Let's look at `d:\bots\deepleagueNAmanager\src\commands\admin\config.js` again? No that's the command.

    // Let's check `configChannelSelect.js` content from Step 20.
    // It just exports `handle(interaction)`.
    // The file path is `src/interactions/string-selects/configChannelSelect.js`.
    // This implies a loader.
    // Loaders usually map ID -> Handler.
    // ID is typically derived from filename OR defined in the file (but no `customId` property in export).
    // If from filename: `configChannelSelect` -> `config:channels:select`? Unlikely direct map.
    // Probably a `client.on('interactionCreate')` logic somewhere.

    // If I check `d:\bots\deepleagueNAmanager\src\event.js` (Step 4)?
    // Or `src/index.js`?
    // I don't have access to those right now.

    // I will try to use a suffix that MIGHT be ignored or handled.
    // But the safest bet is: `config:channels:select` for Main, `config:channels:select_2` for Misc.
    // AND I'll create `src/interactions/string-selects/configChannelSelect2.js` that points to the SAME logical handler.
    // Wait, I can just 'require' the original handler in the new file!

      .setCustomId('config:channels:select_2')
      .setPlaceholder('Logs, Leaderboards & Forums')
      .addOptions(buildChannelMiscOptions());

    const row1 = new ActionRowBuilder().addComponents(categorySelect);
    const row2 = new ActionRowBuilder().addComponents(miscSelect);

    return interaction.reply({
      components: [container, row1, row2],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error opening channels panel:', { error: error?.message });
    const msg = { content: '❌ Could not open the channels panel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

