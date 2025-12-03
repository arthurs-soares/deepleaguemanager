/**
 * Calculate leaderboard statistics
 * @param {Array} guilds - Array of guild objects
 * @returns {Object} Statistics object
 */
function calculateLeaderboardStats(guilds) {
  if (!guilds || guilds.length === 0) {
    return {
      totalGuilds: 0,
      averageWinRate: 0,
      totalWars: 0,
      activeGuilds: 0
    };
  }

  const totalGuilds = guilds.length;

  const totalWins = guilds.reduce((sum, g) => sum + (g.wins || 0), 0);
  const totalLosses = guilds.reduce((sum, g) => sum + (g.losses || 0), 0);
  const totalWars = totalWins + totalLosses;
  const averageWinRate = totalWars > 0 ? totalWins / totalWars : 0;

  const activeGuilds = guilds
    .filter(g => (g.wins || 0) + (g.losses || 0) > 0).length;

  return {
    totalGuilds,
    averageWinRate,
    totalWars,
    activeGuilds
  };
}

/**
 * @param {Object} stats - Statistics object
 * @returns {string} Formatted statistics string
 */
function formatStatsDisplay(stats) {
  const winRatePercent = (stats.averageWinRate * 100).toFixed(1);

  return [
    `📊 **${stats.totalGuilds}** guilds registered`,
    `⚔️ **${stats.totalWars}** total wars fought`,
    `🎯 **${winRatePercent}%** average win rate`
  ].join(' • ');
}

/**
 * Get performance trend indicator
 * @param {Object} guild - Guild object
 * @returns {string} Trend indicator
 */
function getPerformanceTrend(guild) {
  const wins = guild.wins || 0;
  const losses = guild.losses || 0;
  const total = wins + losses;

  if (total === 0) return '🆕';

  const winRate = wins / total;
  if (winRate >= 0.8) return '🔥';
  if (winRate >= 0.6) return '📈';
  if (winRate >= 0.4) return '➡️';
  return '📉';
}

module.exports = {
  calculateLeaderboardStats,
  formatStatsDisplay,
  getPerformanceTrend
};
