const { StringSelectMenuOptionBuilder } = require('discord.js');

/**
 * Build channel configuration select menu options
 * @returns {StringSelectMenuOptionBuilder[]}
 */
function buildChannelConfigOptions() {
  return [
    // 🎫 Ticket Channels
    new StringSelectMenuOptionBuilder()
      .setLabel('War Tickets Channel').setDescription('Channel for war ticket panels')
      .setValue('warTickets').setEmoji('🎫'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Wager Tickets Channel').setDescription('Channel for wager ticket panels')
      .setValue('wagerTickets').setEmoji('🎫'),
    new StringSelectMenuOptionBuilder()
      .setLabel('General Tickets Channel').setDescription('Channel for general ticket panels')
      .setValue('generalTickets').setEmoji('🎫'),

    // 📁 Categories
    new StringSelectMenuOptionBuilder()
      .setLabel('War Category (SA)').setDescription('Category for South America war channels')
      .setValue('warCategorySA').setEmoji('🌎'),
    new StringSelectMenuOptionBuilder()
      .setLabel('War Category (NAE)').setDescription('Category for NA East war channels')
      .setValue('warCategoryNAE').setEmoji('🌎'),
    new StringSelectMenuOptionBuilder()
      .setLabel('War Category (NAW)').setDescription('Category for NA West war channels')
      .setValue('warCategoryNAW').setEmoji('🌎'),
    new StringSelectMenuOptionBuilder()
      .setLabel('War Category (EU)').setDescription('Category for Europe war channels')
      .setValue('warCategoryEU').setEmoji('🌍'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Wager Category').setDescription('Category for wager channels')
      .setValue('wagerCategory').setEmoji('📁'),
    new StringSelectMenuOptionBuilder()
      .setLabel('General Tickets Category').setDescription('Category for general ticket channels')
      .setValue('generalTicketsCategory').setEmoji('📁'),

    // 🏆 Leaderboards
    new StringSelectMenuOptionBuilder()
      .setLabel('Guild Leaderboard Channel').setDescription('Channel for guild leaderboard auto-updates')
      .setValue('leaderboard').setEmoji('🏆'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Wager Leaderboard Channel').setDescription('Channel for wager leaderboard auto-updates')
      .setValue('wagerLeaderboard').setEmoji('🎲'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Event Points Leaderboard').setDescription('Channel for event points leaderboard')
      .setValue('eventPointsLeaderboard').setEmoji('⭐'),

    // � Transcripts
    new StringSelectMenuOptionBuilder()
      .setLabel('War Transcripts Channel').setDescription('Channel for war ticket transcripts')
      .setValue('warTranscripts').setEmoji('📜'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Wager Transcripts Channel').setDescription('Channel for wager ticket transcripts')
      .setValue('wagerTranscripts').setEmoji('📜'),
    new StringSelectMenuOptionBuilder()
      .setLabel('General Transcripts Channel').setDescription('Channel for general ticket transcripts')
      .setValue('generalTranscripts').setEmoji('📜'),

    // 📢 Notifications
    new StringSelectMenuOptionBuilder()
      .setLabel('Logs Channel').setDescription('Channel for bot actions and command logs')
      .setValue('logs').setEmoji('📢'),
    new StringSelectMenuOptionBuilder()
      .setLabel('DM Warning Channel').setDescription('Channel for DM warning notifications')
      .setValue('dmWarning').setEmoji('📢'),
    new StringSelectMenuOptionBuilder()
      .setLabel('War Dodge Channel').setDescription('Channel for war dodge notifications')
      .setValue('warDodge').setEmoji('📢'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Wager Dodge Channel').setDescription('Channel for wager dodge notifications')
      .setValue('wagerDodge').setEmoji('🎲'),
    new StringSelectMenuOptionBuilder()
      .setLabel('War Logs Channel').setDescription('Channel for war log messages')
      .setValue('warLogs').setEmoji('⚔️'),

    // 📋 Other
    new StringSelectMenuOptionBuilder()
      .setLabel('Roster Forum (SA)').setDescription('Forum for South America region rosters')
      .setValue('rosterForumSA').setEmoji('🌎'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Roster Forum (NA)').setDescription('Forum for North America region rosters')
      .setValue('rosterForumNA').setEmoji('🌎'),
    new StringSelectMenuOptionBuilder()
      .setLabel('Roster Forum (EU)').setDescription('Forum for Europe region rosters')
      .setValue('rosterForumEU').setEmoji('🌍')
  ];
}

/**
 * Build channels display text from config
 * @param {Object} cfg - Server settings config
 * @returns {string}
 */
function buildChannelsDisplayText(cfg) {
  const ch = (id) => id ? `<#${id}>` : '—';
  return (
    `**War Tickets Channel:** ${ch(cfg.warTicketsChannelId)}\n` +
    `**Wager Tickets Channel:** ${ch(cfg.wagerTicketsChannelId)}\n` +
    `**General Tickets Channel:** ${ch(cfg.generalTicketsChannelId)}\n` +
    `**War Category (SA):** ${ch(cfg.warCategorySAId)}\n` +
    `**War Category (NAE):** ${ch(cfg.warCategoryNAEId)}\n` +
    `**War Category (NAW):** ${ch(cfg.warCategoryNAWId)}\n` +
    `**War Category (EU):** ${ch(cfg.warCategoryEUId)}\n` +
    `**Wager Category:** ${ch(cfg.wagerCategoryId)}\n` +
    `**General Tickets Category:** ${ch(cfg.generalTicketsCategoryId)}\n` +
    `**War Transcripts Channel:** ${ch(cfg.warTranscriptsChannelId)}\n` +
    `**Wager Transcripts Channel:** ${ch(cfg.wagerTranscriptsChannelId)}\n` +
    `**General Transcripts Channel:** ${ch(cfg.generalTranscriptsChannelId)}\n` +
    `**Logs Channel:** ${ch(cfg.logsChannelId)}\n` +
    `**DM Warning Channel:** ${ch(cfg.dmWarningChannelId)}\n` +
    `**War Dodge Channel:** ${ch(cfg.warDodgeChannelId)}\n` +
    `**Wager Dodge Channel:** ${ch(cfg.wagerDodgeChannelId)}\n` +
    `**War Logs Channel:** ${ch(cfg.warLogsChannelId)}\n` +
    `**Roster Forum (SA):** ${ch(cfg.rosterForumSAChannelId)}\n` +
    `**Roster Forum (NA):** ${ch(cfg.rosterForumNAChannelId)}\n` +
    `**Roster Forum (EU):** ${ch(cfg.rosterForumEUChannelId)}\n` +
    `**Guild Leaderboard Channel:** ${ch(cfg.leaderboardChannelId)}\n` +
    `**Wager Leaderboard Channel:** ${ch(cfg.wagerLeaderboardChannelId)}\n` +
    `**Event Points Leaderboard:** ${ch(cfg.eventPointsLeaderboardChannelId)}`
  );
}

module.exports = { buildChannelConfigOptions, buildChannelsDisplayText };
