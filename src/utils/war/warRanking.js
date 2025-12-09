/**
 * Calcula ranking com base em vitórias/derrotas
 * Aceita (wins, losses) ou objeto { wins, losses }
 */
function calcRatio(winsOrObj, losses) {
  const w = typeof winsOrObj === 'object' && winsOrObj !== null ? (winsOrObj.wins || 0) : (winsOrObj || 0);
  const l = typeof winsOrObj === 'object' && winsOrObj !== null ? (winsOrObj.losses || 0) : (losses || 0);
  const total = w + l;
  if (total === 0) return 0;
  return w / total;
}

function sortByRanking(guilds) {
  return [...(guilds || [])].sort((a, b) => {
    // Sort by Wins (Descending)
    const winsA = (a.wins || 0);
    const winsB = (b.wins || 0);
    if (winsB !== winsA) return winsB - winsA;

    // Tie-breaker 1: Losses (Ascending) -> Less losses = better rank
    const lossesA = (a.losses || 0);
    const lossesB = (b.losses || 0);
    if (lossesA !== lossesB) return lossesA - lossesB;

    // Tie-breaker 2: Name (Alphabetical)
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

module.exports = { calcRatio, sortByRanking };

