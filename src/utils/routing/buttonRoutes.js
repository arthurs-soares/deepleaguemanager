// Button routes map => handler file
// Keeps main handler lean and compliant with rules

/**
 * Returns the handler module based on customId
 * @param {string} customId
 */
function resolveButtonHandler(customId) {
  if (customId.startsWith('guildas_page:')) return '../interactions/buttons/guild/guildsPagination';
  if (customId.startsWith('guild_panel:edit_roster:')) return '../interactions/buttons/guild/editRoster';
  if (customId.startsWith('guild_panel:transfer_leadership:')) return '../interactions/buttons/guild/transferLeadership';
  if (customId.startsWith('guild_panel:change_co_leader:')) return '../interactions/buttons/guild/changeCoLeader';
  if (customId.startsWith('guild_panel:add_co_leader:')) return '../interactions/buttons/guild/addCoLeader';
  if (customId.startsWith('guild_panel:edit_data:')) return '../interactions/buttons/guild/editGuildData';
  if (customId.startsWith('guild_panel:manage_managers:')) return '../interactions/buttons/guild/manageManagers';
  if (customId.startsWith('coLeader:removeConfirm:')) return '../interactions/buttons/guild/coLeaderRemoveConfirm';
  if (customId.startsWith('coLeader:addConfirm:')) return '../interactions/buttons/guild/coLeaderAddConfirm';

  // Leaderboards pagination
  if (customId.startsWith('eventpoints_lb:')) return '../interactions/buttons/leaderboard/eventPointsPagination';

  if (customId === 'war:start') return '../interactions/buttons/war/warStart';
  if (customId.startsWith('war:openScheduleModal:')) return '../interactions/buttons/war/warOpenScheduleModal';
  if (customId.startsWith('war:confirm:accept:')) return '../interactions/buttons/war/warConfirmAccept';
  if (customId.startsWith('war:confirm:dodge:')) return '../interactions/buttons/war/warConfirmDodge';
  if (customId.startsWith('war:dodge:apply:')) return '../interactions/buttons/war/warDodgeApply';
  if (customId.startsWith('war:dodge:cancel:')) return '../interactions/buttons/war/warDodgeCancel';
  if (customId.startsWith('war:declareWinner:confirm:')) return '../interactions/buttons/war/warDeclareWinnerConfirm';
  if (customId.startsWith('war:declareWinner:cancel:')) return '../interactions/buttons/war/warDeclareWinnerCancel';
  if (customId.startsWith('war:declareWinner:')) return '../interactions/buttons/war/warDeclareWinner';
  if (customId.startsWith('war:claim:')) return '../interactions/buttons/war/warClaimTicket';
  if (customId.startsWith('war:closeTicket:confirm:')) return '../interactions/buttons/war/warCloseTicketConfirm';
  if (customId.startsWith('war:closeTicket:cancel:')) return '../interactions/buttons/war/warCloseTicketCancel';
  if (customId.startsWith('war:closeTicket:')) return '../interactions/buttons/war/warCloseTicket';

  // Wager
  if (customId === 'wager:start') return '../interactions/buttons/wager/wagerStart';
  if (customId === 'wager:start2v2') return '../interactions/buttons/wager/wagerStart2v2';
  if (customId.startsWith('wager:createTicket2v2:')) return '../interactions/buttons/wager/wagerCreateTicket2v2';
  if (customId.startsWith('wager:createTicket:')) return '../interactions/buttons/wager/wagerCreateTicket';
  if (customId.startsWith('wager:closeTicket:confirm:')) return '../interactions/buttons/wager/wagerCloseTicketConfirm';
  if (customId.startsWith('wager:closeTicket:cancel:')) return '../interactions/buttons/wager/wagerCloseTicketCancel';
  if (customId.startsWith('wager:closeTicket:')) return '../interactions/buttons/wager/wagerCloseTicket';
  if (customId.startsWith('wager:markDodge:')) return '../interactions/buttons/wager/wagerMarkDodge';
  if (customId.startsWith('wager:dodge:apply:')) return '../interactions/buttons/wager/wagerDodgeApply';
  if (customId.startsWith('wager:dodge:cancel:')) return '../interactions/buttons/wager/wagerDodgeCancel';
  if (customId.startsWith('wager:accept:')) return '../interactions/buttons/wager/wagerAccept';
  if (customId.startsWith('wager:claim:')) return '../interactions/buttons/wager/wagerClaimTicket';
  if (customId.startsWith('wager:decideWinner:confirm:')) return '../interactions/buttons/wager/wagerDecideWinnerConfirm';
  if (customId.startsWith('wager:decideWinner:cancel:')) return '../interactions/buttons/wager/wagerDecideWinnerCancel';
  if (customId.startsWith('wager:decideWinner:')) return '../interactions/buttons/wager/wagerDecideWinner';

  // Support
  if (customId === 'support:closeThread') return '../interactions/buttons/support/supportCloseThread';
  if (customId === 'support:call') return '../interactions/buttons/support/supportCall';

  if (customId.startsWith('viewGuild:history:')) return '../interactions/buttons/guild/viewGuildHistory';
  if (customId.startsWith('viewGuild:rosterHistory:')) return '../interactions/buttons/guild/viewRosterHistory';
  if (customId.startsWith('viewGuild:back:')) return '../interactions/buttons/guild/viewGuildBack';

  // Roster invite flow
  if (customId.startsWith('rosterInvite:sendConfirm:')) return '../interactions/buttons/roster/inviteSendConfirm';
  if (customId.startsWith('rosterInvite:accept:')) return '../interactions/buttons/roster/inviteAccept';
  if (customId.startsWith('rosterInvite:decline:')) return '../interactions/buttons/roster/inviteDecline';

  // Manager invite flow
  if (customId.startsWith('managerInvite:accept:')) return '../interactions/buttons/guild/managerInviteAccept';
  if (customId.startsWith('managerInvite:decline:')) return '../interactions/buttons/guild/managerInviteDecline';
  if (customId.startsWith('manager:inviteConfirm:')) return '../interactions/buttons/guild/managerInviteConfirm';
  if (customId.startsWith('manager:remove:')) return '../interactions/buttons/guild/removeManager';

  // Co-leader invite flow
  if (customId.startsWith('coLeaderInvite:accept:')) return '../interactions/buttons/guild/coLeaderInviteAccept';
  if (customId.startsWith('coLeaderInvite:decline:')) return '../interactions/buttons/guild/coLeaderInviteDecline';

  // Change Co-leader invite flow
  if (customId.startsWith('changeCoLeaderInvite:accept:')) return '../interactions/buttons/guild/changeCoLeaderInviteAccept';
  if (customId.startsWith('changeCoLeaderInvite:decline:')) return '../interactions/buttons/guild/changeCoLeaderInviteDecline';

  // Leader invite flow (leadership transfer confirmation)
  if (customId.startsWith('leaderInvite:accept:')) return '../interactions/buttons/guild/leaderInviteAccept';
  if (customId.startsWith('leaderInvite:decline:')) return '../interactions/buttons/guild/leaderInviteDecline';

  if (customId === 'profile:edit') return '../interactions/buttons/profile/editProfile';
  if (customId === 'profile:leaveGuild') return '../interactions/buttons/profile/leaveGuild';
  if (customId.startsWith('profile:confirmLeave:')) return '../interactions/buttons/profile/confirmLeaveGuild';

  if (customId === 'config:roles') return '../interactions/buttons/config/configOpenRoles';
  if (customId === 'config:channels') return '../interactions/buttons/config/configOpenChannels';
  if (customId === 'config:ranks') return '../interactions/buttons/config/configOpenRanks';
  if (customId === 'config:channels:setRosterForum') return '../interactions/buttons/config/configSetRosterForum';
  if (customId === 'config:channels:setWarTickets') return '../interactions/buttons/config/configSetWarTickets';
  if (customId === 'config:channels:setWagerTickets') return '../interactions/buttons/config/configSetWagerTickets';
  if (customId === 'config:channels:setWagerCategory') return '../interactions/buttons/config/configSetWagerCategory';
  if (customId === 'config:channels:setLogs') return '../interactions/buttons/config/configSetLogs';
  if (customId === 'config:channels:setLeaderboard') return '../interactions/buttons/config/configSetLeaderboardChannel';
  if (customId === 'config:channels:setWarDodge') return '../interactions/buttons/config/configSetWarDodge';
  if (customId === 'config:channels:setDmWarning') return '../interactions/buttons/config/configSetDmWarning';
  if (customId === 'config:roles:setLeader' || customId === 'config:roles:setCoLeader') return '../interactions/buttons/config/configRolesSetSingle';
  if (customId === 'config:roles:setModerators' || customId === 'config:roles:setHosters' || customId === 'config:roles:setSupport') return '../interactions/buttons/config/configRolesSetMulti';

  // General Tickets
  if (customId.startsWith('ticket:open:')) return '../interactions/buttons/ticket/ticketOpen';
  if (customId.startsWith('ticket:close:confirm:')) return '../interactions/buttons/ticket/ticketCloseConfirm';
  if (customId.startsWith('ticket:close:cancel:')) return '../interactions/buttons/ticket/ticketCloseCancel';
  if (customId.startsWith('ticket:close:')) return '../interactions/buttons/ticket/ticketClose';

  // War Log
  if (customId.startsWith('wl:r:')) return '../interactions/buttons/warLog/warLogRound';
  if (customId.startsWith('wl:s:')) return '../interactions/buttons/warLog/warLogSubmit';
  if (customId.startsWith('wl:mvp:')) return '../interactions/buttons/warLog/warLogMvp';

  return null;
}

module.exports = { resolveButtonHandler };

