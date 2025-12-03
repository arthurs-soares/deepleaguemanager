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
  if (customId.startsWith('roster_user_select:')) return '../interactions/user-selects/rosterUserSelect';
  if (customId.startsWith('roster_member_select:')) return '../interactions/selects/rosterMemberSelect';
  if (customId.startsWith('transfer_leader_user_select:')) return '../interactions/user-selects/transferLeaderUserSelect';
  if (customId.startsWith('add_co_leader_user_select:')) return '../interactions/user-selects/addCoLeaderUserSelect';
  if (customId.startsWith('change_co_leader_user_select:')) return '../interactions/user-selects/changeCoLeaderUserSelect';
  if (customId.startsWith('add_manager_user_select:')) return '../interactions/user-selects/addManagerUserSelect';

  if (customId.startsWith('war:selectOpponent:')) return '../interactions/selects/warSelectOpponent';
  if (customId.startsWith('war:dodge:select:')) return '../interactions/selects/warDodgeSelect';
  if (customId === 'wager:selectOpponent') return '../interactions/selects/wagerSelectOpponent';
  if (customId.startsWith('wager:dodge:select:')) return '../interactions/selects/wagerDodgeSelect';

  if (customId.startsWith('config:roles:singleSelect:')) return '../interactions/role-selects/configRoleSingleSelect';
  if (customId.startsWith('config:roles:multiSelect:')) return '../interactions/role-selects/configRoleMultiSelect';

  if (customId === 'config:channels:selectWarTickets') return '../interactions/channel-selects/configWarTicketsSelect';
  if (customId === 'config:channels:selectWagerTickets') return '../interactions/channel-selects/configWagerTicketsSelect';
  if (customId === 'config:channels:selectGeneralTickets') return '../interactions/channel-selects/configGeneralTicketsSelect';
  if (customId === 'config:channels:selectLogs') return '../interactions/channel-selects/configLogsSelect';
  if (customId === 'config:channels:selectLeaderboard') return '../interactions/channel-selects/configLeaderboardSelect';
  if (customId === 'config:channels:selectRosterForum') return '../interactions/channel-selects/configRosterForumSelect';
  if (customId === 'config:channels:selectWarCategory') return '../interactions/channel-selects/configWarCategorySelect';
  if (customId === 'config:channels:selectWagerCategory') return '../interactions/channel-selects/configWagerCategorySelect';
  if (customId === 'config:channels:selectGeneralTicketsCategory') return '../interactions/channel-selects/configGeneralTicketsCategorySelect';
  if (customId === 'config:channels:selectWarDodge') return '../interactions/channel-selects/configWarDodgeSelect';
  if (customId === 'config:channels:selectWagerDodge') return '../interactions/channel-selects/configWagerDodgeSelect';
  if (customId === 'config:channels:selectDmWarning') return '../interactions/channel-selects/configDmWarningSelect';
  if (customId === 'config:channels:selectWagerLeaderboard') return '../interactions/channel-selects/configWagerLeaderboardSelect';
  if (customId === 'config:channels:selectEventPointsLeaderboard') return '../interactions/channel-selects/configEventPointsLeaderboardSelect';
  if (customId === 'config:channels:selectWarLogs') return '../interactions/channel-selects/configWarLogsSelect';

  // New dropdown-based configuration selectors
  if (customId === 'config:channels:select') return '../interactions/string-selects/configChannelSelect';
  if (customId === 'config:roles:select') return '../interactions/string-selects/configRoleSelect';

  // War Log MVP
  if (customId.startsWith('wl:mvpSelect:')) return '../interactions/user-selects/warLogMvpSelect';

  return null;
}

module.exports = { resolveSelectHandler };

