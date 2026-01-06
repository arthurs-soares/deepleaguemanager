// Map of select routes (String/User/Role/Channel) => handler file
// Keeps selectHandler lean and compliant with rules

/**
 * Resolve the handler module based on the select customId
 * @param {string} customId
 * @returns {string|null}
 */
function resolveSelectHandler(customId) {
  if (customId === 'help:categories') return '../interactions/selects/helpCategories';

  if (customId.startsWith('roster_actions:')) return '../interactions/selects/rosterActions';
  if (customId.startsWith('roster_region_select:')) return '../interactions/selects/rosterRegionSelect';
  if (customId.startsWith('roster_user_select:')) return '../interactions/user-selects/rosterUserSelect';
  if (customId.startsWith('roster_member_select:')) return '../interactions/selects/rosterMemberSelect';
  if (customId.startsWith('transfer_leader_user_select:')) return '../interactions/user-selects/transferLeaderUserSelect';
  if (customId.startsWith('add_co_leader_user_select:')) return '../interactions/user-selects/addCoLeaderUserSelect';
  if (customId.startsWith('change_co_leader_user_select:')) return '../interactions/user-selects/changeCoLeaderUserSelect';
  if (customId.startsWith('add_manager_user_select:')) return '../interactions/user-selects/addManagerUserSelect';

  if (customId.startsWith('war:selectRegion:')) return '../interactions/selects/warSelectRegion';
  if (customId.startsWith('war:selectOpponent:')) return '../interactions/selects/warSelectOpponent';
  if (customId.startsWith('war:dodge:select:')) return '../interactions/selects/warDodgeSelect';
  if (customId === 'wager:selectOpponent') return '../interactions/selects/wagerSelectOpponent';
  if (customId === 'wager:select2v2Teammate') return '../interactions/user-selects/wagerSelect2v2Teammate';
  if (customId.startsWith('wager:select2v2Opponents:')) return '../interactions/user-selects/wagerSelect2v2Opponents';
  if (customId.startsWith('wager:dodge:select:')) return '../interactions/selects/wagerDodgeSelect';

  if (customId.startsWith('config:roles:singleSelect:')) return '../interactions/role-selects/configRoleSingleSelect';
  if (customId.startsWith('config:roles:multiSelect:')) return '../interactions/role-selects/configRoleMultiSelect';

  if (customId === 'config:channels:selectWarTickets') return '../interactions/channel-selects/configWarTicketsSelect';
  if (customId === 'config:channels:selectWagerTickets') return '../interactions/channel-selects/configWagerTicketsSelect';
  if (customId === 'config:channels:selectGeneralTickets') return '../interactions/channel-selects/configGeneralTicketsSelect';
  if (customId === 'config:channels:selectLogs') return '../interactions/channel-selects/configLogsSelect';
  if (customId === 'config:channels:selectLeaderboard') return '../interactions/channel-selects/configLeaderboardSelect';
  if (customId === 'config:channels:selectRosterForum') return '../interactions/channel-selects/configRosterForumSelect';
  if (customId === 'config:channels:selectRosterForumSA') return '../interactions/channel-selects/configRosterForumSASelect';
  if (customId === 'config:channels:selectRosterForumNA') return '../interactions/channel-selects/configRosterForumNASelect';
  if (customId === 'config:channels:selectRosterForumEU') return '../interactions/channel-selects/configRosterForumEUSelect';
  if (customId === 'config:channels:selectWarCategorySA') return '../interactions/channel-selects/configWarCategorySASelect';
  if (customId === 'config:channels:selectWarCategoryNAE') return '../interactions/channel-selects/configWarCategoryNAESelect';
  if (customId === 'config:channels:selectWarCategoryNAW') return '../interactions/channel-selects/configWarCategoryNAWSelect';
  if (customId === 'config:channels:selectWarCategoryEU') return '../interactions/channel-selects/configWarCategoryEUSelect';
  if (customId === 'config:channels:selectWarCategorySA2') return '../interactions/channel-selects/configWarCategorySA2Select';
  if (customId === 'config:channels:selectWarCategoryNAE2') return '../interactions/channel-selects/configWarCategoryNAE2Select';
  if (customId === 'config:channels:selectWarCategoryNAW2') return '../interactions/channel-selects/configWarCategoryNAW2Select';
  if (customId === 'config:channels:selectWarCategoryEU2') return '../interactions/channel-selects/configWarCategoryEU2Select';
  if (customId === 'config:channels:selectWagerCategory') return '../interactions/channel-selects/configWagerCategorySelect';
  if (customId === 'config:channels:selectWagerCategory2') return '../interactions/channel-selects/configWagerCategory2Select';
  if (customId === 'config:channels:selectWagerCategory3') return '../interactions/channel-selects/configWagerCategory3Select';
  if (customId === 'config:channels:selectGeneralTicketsCategory') return '../interactions/channel-selects/configGeneralTicketsCategorySelect';
  if (customId === 'config:channels:selectWarDodge') return '../interactions/channel-selects/configWarDodgeSelect';
  if (customId === 'config:channels:selectWagerDodge') return '../interactions/channel-selects/configWagerDodgeSelect';
  if (customId === 'config:channels:selectDmWarning') return '../interactions/channel-selects/configDmWarningSelect';
  if (customId === 'config:channels:selectWagerLeaderboard') return '../interactions/channel-selects/configWagerLeaderboardSelect';
  if (customId === 'config:channels:selectEventPointsLeaderboard') return '../interactions/channel-selects/configEventPointsLeaderboardSelect';
  if (customId === 'config:channels:selectWarLogs') return '../interactions/channel-selects/configWarLogsSelect';
  if (customId === 'config:channels:selectWarTranscripts') return '../interactions/channel-selects/configWarTranscriptsSelect';
  if (customId === 'config:channels:selectWagerTranscripts') return '../interactions/channel-selects/configWagerTranscriptsSelect';
  if (customId === 'config:channels:selectGeneralTranscripts') return '../interactions/channel-selects/configGeneralTranscriptsSelect';
  if (customId === 'config:channels:selectWarCategoryAsia') return '../interactions/channel-selects/configWarCategoryAsiaSelect';
  if (customId === 'config:channels:selectWarCategoryAsia2') return '../interactions/channel-selects/configWarCategoryAsia2Select';
  if (customId === 'config:channels:selectRosterForumAsia') return '../interactions/channel-selects/configRosterForumAsiaSelect';

  // New dropdown-based configuration selectors
  if (customId === 'config:channels:select') return '../interactions/string-selects/configChannelSelect';
  if (customId === 'config:channels:select_2') return '../interactions/string-selects/configChannelSelect2';
  if (customId === 'config:roles:select') return '../interactions/string-selects/configRoleSelect';
  if (customId === 'config:ranks:select') return '../interactions/string-selects/configRankSelect';

  // Guild panel region selector
  if (customId.startsWith('guild_panel:select_region:')) return '../interactions/string-selects/guild/selectRegion';

  // Guild view region selector
  if (customId.startsWith('guild_view:select_region:')) return '../interactions/string-selects/guild/viewSelectRegion';

  // Profile leave guild region selector
  if (customId.startsWith('profile:leaveGuild:selectRegion:')) return '../interactions/string-selects/profile/leaveGuildSelectRegion';

  // Rank role selection
  if (customId.startsWith('config:ranks:roleSelect:')) return '../interactions/role-selects/configRankRoleSelect';

  // War Log MVP
  if (customId.startsWith('wl:mvpSelect:')) return '../interactions/user-selects/warLogMvpSelect';

  return null;
}

module.exports = { resolveSelectHandler };

