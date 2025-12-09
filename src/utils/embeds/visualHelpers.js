/**
 * visualHelpers.js
 * Helpers for visual elements in embeds/containers
 */

/**
 * Create a text-based progress bar
 * @param {number} percentage - Value between 0 and 100
 * @param {number} length - Number of blocks in the bar (default 10)
 * @returns {string} The progress bar string
 */
function createVisualProgressBar(percentage, length = 10) {
  const p = Math.max(0, Math.min(100, percentage));
  const fillCount = Math.round((p / 100) * length);
  const emptyCount = length - fillCount;

  const fillChar = '🟩';
  const emptyChar = '⬛';

  return fillChar.repeat(fillCount) + emptyChar.repeat(emptyCount);
}

module.exports = {
  createVisualProgressBar
};
