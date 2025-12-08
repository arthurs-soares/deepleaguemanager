const { ChannelSelectMenuBuilder, ActionRowBuilder, ChannelType, MessageFlags } = require('discord.js');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle channel configuration dropdown selection
 * CustomId: config:channels:select
 */
async function handle(interaction) {
  try {
    const selectedValue = interaction.values[0];

    // Map selection values to their corresponding channel selectors
    const channelConfigs = {
      warTickets: {
        customId: 'config:channels:selectWarTickets',
        placeholder: 'Select a text channel for war tickets',
        types: [ChannelType.GuildText]
      },
      wagerTickets: {
        customId: 'config:channels:selectWagerTickets',
        placeholder: 'Select a text channel for wager tickets',
        types: [ChannelType.GuildText]
      },
      generalTickets: {
        customId: 'config:channels:selectGeneralTickets',
        placeholder: 'Select a text channel for general tickets',
        types: [ChannelType.GuildText]
      },
      warCategorySA: {
        customId: 'config:channels:selectWarCategorySA',
        placeholder: 'Select a category for SA war channels',
        types: [ChannelType.GuildCategory]
      },
      warCategoryNAE: {
        customId: 'config:channels:selectWarCategoryNAE',
        placeholder: 'Select a category for NA East war channels',
        types: [ChannelType.GuildCategory]
      },
      warCategoryNAW: {
        customId: 'config:channels:selectWarCategoryNAW',
        placeholder: 'Select a category for NA West war channels',
        types: [ChannelType.GuildCategory]
      },
      warCategoryEU: {
        customId: 'config:channels:selectWarCategoryEU',
        placeholder: 'Select a category for EU war channels',
        types: [ChannelType.GuildCategory]
      },
      wagerCategory: {
        customId: 'config:channels:selectWagerCategory',
        placeholder: 'Select primary category for wager channels',
        types: [ChannelType.GuildCategory]
      },
      wagerCategory2: {
        customId: 'config:channels:selectWagerCategory2',
        placeholder: 'Select secondary category for wager channels',
        types: [ChannelType.GuildCategory]
      },
      wagerCategory3: {
        customId: 'config:channels:selectWagerCategory3',
        placeholder: 'Select tertiary category for wager channels',
        types: [ChannelType.GuildCategory]
      },
      generalTicketsCategory: {
        customId: 'config:channels:selectGeneralTicketsCategory',
        placeholder: 'Select a category for general ticket channels',
        types: [ChannelType.GuildCategory]
      },
      leaderboard: {
        customId: 'config:channels:selectLeaderboard',
        placeholder: 'Select a text channel for the guild leaderboard',
        types: [ChannelType.GuildText]
      },
      wagerLeaderboard: {
        customId: 'config:channels:selectWagerLeaderboard',
        placeholder: 'Select a text channel for the wager leaderboard',
        types: [ChannelType.GuildText]
      },
      eventPointsLeaderboard: {
        customId: 'config:channels:selectEventPointsLeaderboard',
        placeholder: 'Select a text channel for the event points leaderboard',
        types: [ChannelType.GuildText]
      },
      logs: {
        customId: 'config:channels:selectLogs',
        placeholder: 'Select a text channel for logs',
        types: [ChannelType.GuildText]
      },
      dmWarning: {
        customId: 'config:channels:selectDmWarning',
        placeholder: 'Select a text channel for DM warnings',
        types: [ChannelType.GuildText]
      },
      warDodge: {
        customId: 'config:channels:selectWarDodge',
        placeholder: 'Select a text channel for war dodge notifications',
        types: [ChannelType.GuildText]
      },
      wagerDodge: {
        customId: 'config:channels:selectWagerDodge',
        placeholder: 'Select a text channel for wager dodge notifications',
        types: [ChannelType.GuildText]
      },
      warLogs: {
        customId: 'config:channels:selectWarLogs',
        placeholder: 'Select a text channel for war logs',
        types: [ChannelType.GuildText]
      },
      warTranscripts: {
        customId: 'config:channels:selectWarTranscripts',
        placeholder: 'Select a text channel for war transcripts',
        types: [ChannelType.GuildText]
      },
      wagerTranscripts: {
        customId: 'config:channels:selectWagerTranscripts',
        placeholder: 'Select a text channel for wager transcripts',
        types: [ChannelType.GuildText]
      },
      generalTranscripts: {
        customId: 'config:channels:selectGeneralTranscripts',
        placeholder: 'Select a text channel for general ticket transcripts',
        types: [ChannelType.GuildText]
      },
      rosterForum: {
        customId: 'config:channels:selectRosterForum',
        placeholder: 'Select a forum channel for guild rosters',
        types: [ChannelType.GuildForum]
      },
      rosterForumSA: {
        customId: 'config:channels:selectRosterForumSA',
        placeholder: 'Select a forum channel for SA region rosters',
        types: [ChannelType.GuildForum]
      },
      rosterForumNA: {
        customId: 'config:channels:selectRosterForumNA',
        placeholder: 'Select a forum channel for NA region rosters',
        types: [ChannelType.GuildForum]
      },
      rosterForumEU: {
        customId: 'config:channels:selectRosterForumEU',
        placeholder: 'Select a forum channel for EU region rosters',
        types: [ChannelType.GuildForum]
      }
    };

    const config = channelConfigs[selectedValue];
    if (!config) {
      return interaction.reply({
        content: '❌ Invalid selection.',
        flags: MessageFlags.Ephemeral
      });
    }

    // Create channel selector based on the configuration
    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(config.customId)
      .setPlaceholder(config.placeholder)
      .setChannelTypes(...config.types);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    return interaction.reply({
      components: [row],
      flags: MessageFlags.Ephemeral
    });

  } catch (error) {
    LoggerService.error('Error handling channel configuration selection:', { error: error?.message });
    const msg = { content: '❌ Could not process selection.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };
