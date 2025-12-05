module.exports = {
  // Bot configuration
  prefix: '!',
  ownerIds: ['YOUR_USER_ID_HERE'],

  // Colors for embeds
  colors: {
    success: 0x00ff00,
    error: 0xff0000,
    warning: 0xffff00,
    warningAlt: 0xffaa00,
    info: 0x0099ff,
    primary: 0x5865f2,
    war: 0x908676,
    wager: 0x465d49,
    general: 0x808080
  },

  // Emojis
  emojis: {
    // Custom Discord emojis
    success: '<:dl_check:1446181299235721226>',
    error: '<:dl_x:1446181293896503399>',
    warning: '<:dl_warn:1446181291988095036>',
    loading: '<:dl_loading:1446181299235721226>',
    info: 'ℹ️',
    guild: '<:dl_leader:1446150269531459604>',
    leader: '<:dl_leader:1446150269531459604>',
    coLeader: '<:dl_coleader:1446150271808835745>',
    manager: '👔',
    status: '<:dl_status:1446181295918157986>',
    members: '<:dl_users:1446181287848185976>',
    created: '<:dl_calendar:1446181295918157986>',
    rosters: '<:dl_mainroster:1446181305531498658>',
    winsLosses: '<:dl_chart:1446187531543511296>',
    mainRoster: '<:dl_mainroster:1446181305531498658>',
    subRoster: '<:dl_subroster:1446181309377413262>',
    war: '<:dl_war:1446181290515763263>',
    warTicket: '<:dl_warticket:1446164733215510600>',
    depthsWager: '<:dl_depthswager:1446164770066792508>',
    schedule: '<:dl_calendar:1446181295918157986>',
    channel: '<:dl_channel:1446181297499279531>',
    history: '<:dl_history:1446181301244793059>',
    leaderboard: '<:dl_trophy:1446181313190035498>',
    page: '<:dl_page:1446181307397832838>',
    ticket: '<:dl_ticket:1446181346505392199>',
    region: '<:dl_region:1446183250308501644>',

    // Unicode emojis - Ranks
    rankFirst: '🥇',
    rankSecond: '🥈',
    rankThird: '🥉',
    rankTop5: '🏆',
    rankDefault: '🔸',
    rankMedal: '🏅',

    // Custom Discord emojis - Rank Tiers
    rankTop10: '<:dl_top10:1446150244575346849>',
    rankIron1: '<:dl_iron1:1446150134411952314>',
    rankIron2: '<:dl_iron2:1446150132583235584>',
    rankIron3: '<:dl_iron3:1446150130456727573>',
    rankSilver1: '<:dl_silver1:1446150137595428944>',
    rankSilver2: '<:dl_silver2:1446150127495676015>',
    rankSilver3: '<:dl_silver3:1446150136144068771>',
    rankGold1: '<:dl_gold1:1446150167459008614>',
    rankGold2: '<:dl_gold2:1446150169711349920>',
    rankGold3: '<:dl_gold3:1446150171758166227>',
    rankPlatinum1: '<:dl_plat1:1446150190355714160>',
    rankPlatinum2: '<:dl_plat2:1446150191819526258>',
    rankPlatinum3: '<:dl_plat3:1446150194583437424>',
    rankDiamond1: '<:dl_diamond1:1446150209276088393>',
    rankDiamond2: '<:dl_diamond2:1446150229471662100>',
    rankMaster: '<:dl_master:1446150211151069359>',
    rankGrandMaster: '<:dl_grandmaster:1446150207577395283>',

    // Unicode emojis - Trends & Stats
    trendUp: '📈',
    trendNeutral: '➡️',
    trendDown: '📉',
    trendChart: '📊',
    trendFire: '🔥',
    newEntry: '🆕',

    // Unicode emojis - Ticket types
    blacklistAppeal: '📝',
    generalChat: '💬',

    // Unicode emojis - Help menu
    commands: '📁',
    security: '🔐',
    admin: '🛡️',
    dice: '<:dl_wager:1446190454642049074>',
    swords: '⚔️',
    trophy: '<:dl_trophy:1446181313190035498>'
  },

  // Cooldowns (in seconds)
  cooldowns: {
    default: 3,
    moderation: 5,
    economy: 10
  }
};
