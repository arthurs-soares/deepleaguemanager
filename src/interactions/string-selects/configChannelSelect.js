const {
  ChannelSelectMenuBuilder, ActionRowBuilder,
  ChannelType, MessageFlags
} = require('discord.js');
const LoggerService = require('../../services/LoggerService');

// Channel configuration map (key -> { customId, placeholder, types })
const CHANNEL_CONFIGS = {
  warTickets: {
    customId: 'config:channels:selectWarTickets',
    placeholder: 'Select text channel for war tickets',
    types: [ChannelType.GuildText]
  },
  wagerTickets: {
    customId: 'config:channels:selectWagerTickets',
    placeholder: 'Select text channel for wager tickets',
    types: [ChannelType.GuildText]
  },
  generalTickets: {
    customId: 'config:channels:selectGeneralTickets',
    placeholder: 'Select text channel for general tickets',
    types: [ChannelType.GuildText]
  },
  warCategorySA: {
    customId: 'config:channels:selectWarCategorySA',
    placeholder: 'Select category for SA war channels',
    types: [ChannelType.GuildCategory]
  },
  warCategorySA2: {
    customId: 'config:channels:selectWarCategorySA2',
    placeholder: 'Select secondary category for SA wars',
    types: [ChannelType.GuildCategory]
  },
  warCategoryNAE: {
    customId: 'config:channels:selectWarCategoryNAE',
    placeholder: 'Select category for NA East wars',
    types: [ChannelType.GuildCategory]
  },
  warCategoryNAE2: {
    customId: 'config:channels:selectWarCategoryNAE2',
    placeholder: 'Select secondary category for NA East wars',
    types: [ChannelType.GuildCategory]
  },
  warCategoryNAW: {
    customId: 'config:channels:selectWarCategoryNAW',
    placeholder: 'Select category for NA West wars',
    types: [ChannelType.GuildCategory]
  },
  warCategoryNAW2: {
    customId: 'config:channels:selectWarCategoryNAW2',
    placeholder: 'Select secondary category for NA West wars',
    types: [ChannelType.GuildCategory]
  },
  warCategoryEU: {
    customId: 'config:channels:selectWarCategoryEU',
    placeholder: 'Select category for EU wars',
    types: [ChannelType.GuildCategory]
  },
  warCategoryEU2: {
    customId: 'config:channels:selectWarCategoryEU2',
    placeholder: 'Select secondary category for EU wars',
    types: [ChannelType.GuildCategory]
  },
  wagerCategory: {
    customId: 'config:channels:selectWagerCategory',
    placeholder: 'Select primary category for wagers',
    types: [ChannelType.GuildCategory]
  },
  wagerCategory2: {
    customId: 'config:channels:selectWagerCategory2',
    placeholder: 'Select secondary category for wagers',
    types: [ChannelType.GuildCategory]
  },
  wagerCategory3: {
    customId: 'config:channels:selectWagerCategory3',
    placeholder: 'Select tertiary category for wagers',
    types: [ChannelType.GuildCategory]
  },
  generalTicketsCategory: {
    customId: 'config:channels:selectGeneralTicketsCategory',
    placeholder: 'Select category for general tickets',
    types: [ChannelType.GuildCategory]
  },
  leaderboard: {
    customId: 'config:channels:selectLeaderboard',
    placeholder: 'Select text channel for guild leaderboard',
    types: [ChannelType.GuildText]
  },
  wagerLeaderboard: {
    customId: 'config:channels:selectWagerLeaderboard',
    placeholder: 'Select text channel for wager leaderboard',
    types: [ChannelType.GuildText]
  },
  eventPointsLeaderboard: {
    customId: 'config:channels:selectEventPointsLeaderboard',
    placeholder: 'Select text channel for event points leaderboard',
    types: [ChannelType.GuildText]
  },
  logs: {
    customId: 'config:channels:selectLogs',
    placeholder: 'Select text channel for logs',
    types: [ChannelType.GuildText]
  },
  dmWarning: {
    customId: 'config:channels:selectDmWarning',
    placeholder: 'Select text channel for DM warnings',
    types: [ChannelType.GuildText]
  },
  warDodge: {
    customId: 'config:channels:selectWarDodge',
    placeholder: 'Select text channel for war dodge notifications',
    types: [ChannelType.GuildText]
  },
  wagerDodge: {
    customId: 'config:channels:selectWagerDodge',
    placeholder: 'Select text channel for wager dodge notifications',
    types: [ChannelType.GuildText]
  },
  warLogs: {
    customId: 'config:channels:selectWarLogs',
    placeholder: 'Select text channel for war logs',
    types: [ChannelType.GuildText]
  },
  warTranscripts: {
    customId: 'config:channels:selectWarTranscripts',
    placeholder: 'Select text channel for war transcripts',
    types: [ChannelType.GuildText]
  },
  wagerTranscripts: {
    customId: 'config:channels:selectWagerTranscripts',
    placeholder: 'Select text channel for wager transcripts',
    types: [ChannelType.GuildText]
  },
  generalTranscripts: {
    customId: 'config:channels:selectGeneralTranscripts',
    placeholder: 'Select text channel for general transcripts',
    types: [ChannelType.GuildText]
  },
  rosterForum: {
    customId: 'config:channels:selectRosterForum',
    placeholder: 'Select forum channel for guild rosters',
    types: [ChannelType.GuildForum]
  },
  rosterForumSA: {
    customId: 'config:channels:selectRosterForumSA',
    placeholder: 'Select forum channel for SA rosters',
    types: [ChannelType.GuildForum]
  },
  rosterForumNA: {
    customId: 'config:channels:selectRosterForumNA',
    placeholder: 'Select forum channel for NA rosters',
    types: [ChannelType.GuildForum]
  },
  rosterForumEU: {
    customId: 'config:channels:selectRosterForumEU',
    placeholder: 'Select forum channel for EU rosters',
    types: [ChannelType.GuildForum]
  }
};

/**
 * Handle channel configuration dropdown selection
 * CustomId: config:channels:select
 */
async function handle(interaction) {
  try {
    const selectedValue = interaction.values[0];
    const config = CHANNEL_CONFIGS[selectedValue];

    if (!config) {
      return interaction.reply({
        content: '❌ Invalid selection.',
        flags: MessageFlags.Ephemeral
      });
    }

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
    LoggerService.error('Error handling channel config selection:', {
      error: error?.message
    });
    const msg = {
      content: '❌ Could not process selection.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp(msg);
    }
    return interaction.reply(msg);
  }
}

module.exports = { handle };
