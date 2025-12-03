/**
 * Get rank emoji based on position
 * @param {number} rank - Position in leaderboard (1-indexed)
 * @returns {string} Emoji for the rank
 */
function getRankEmoji(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  if (rank <= 5) return '🏆';
  if (rank <= 10) return '⭐';
  return '🔸';
}

/**
 * Create visual win rate bar
 * @param {number} winRate - Win rate as decimal (0-1)
 * @returns {string} Visual progress bar
 */
function createWinRateBar(winRate) {
  const filled = Math.round(winRate * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format win rate percentage with color indicator
 * @param {number} winRate - Win rate as decimal (0-1)
 * @returns {string} Formatted percentage with indicator
 */
function formatWinRateDisplay(winRate) {
  const percentage = (winRate * 100).toFixed(1);
  let indicator = '➡️';

  if (winRate >= 0.8) indicator = '📈';
  else if (winRate >= 0.6) indicator = '📊';
  else if (winRate < 0.4) indicator = '📉';

  return `${percentage}% ${indicator}`;
}

/**
 * Format guild name with proper spacing
 * @param {string} name - Guild name
 * @param {number} maxLength - Maximum length for alignment
 * @returns {string} Formatted name
 */
function formatGuildName(name, maxLength = 20) {
  if (name.length <= maxLength) {
    return name.padEnd(maxLength, ' ');
  }
  return name.substring(0, maxLength - 1) + '…';
}

module.exports = {
  getRankEmoji,
  createWinRateBar,
  formatWinRateDisplay,
  formatGuildName
};
