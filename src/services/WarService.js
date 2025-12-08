const War = require('../models/war/War');
const Guild = require('../models/guild/Guild');
const LoggerService = require('./LoggerService');

/**
 * Service for War related business logic
 */
class WarService {
    /**
     * Mark a war as dodged
     * @param {string} warId
     * @param {string} dodgerGuildId
     * @returns {Promise<{war: Object, dodger: Object}>}
     */
    async markDodge(warId, dodgerGuildId) {
        const war = await War.findById(warId);
        if (!war) {
            throw new Error('War not found');
        }
        if (war.status !== 'aberta') {
            throw new Error('War is not open for dodge');
        }

        const dodger = await Guild.findById(dodgerGuildId);
        if (!dodger) {
            throw new Error('Dodger guild not found');
        }

        war.status = 'dodge';
        war.dodgedByGuildId = dodger._id;
        await war.save();

        LoggerService.info('War marked as dodge', { warId, dodgerGuildId });
        return { war, dodger };
    }

    /**
     * Undo a war dodge
     * @param {string} warId
     * @returns {Promise<{war: Object}>}
     */
    async undoDodge(warId) {
        const war = await War.findById(warId);
        if (!war) {
            throw new Error('War not found');
        }
        if (war.status !== 'dodge' || !war.dodgedByGuildId) {
            throw new Error('War is not in dodge state');
        }

        const beforeStatus = war.status;
        war.status = 'aberta';
        war.dodgedByGuildId = null;
        await war.save();

        LoggerService.info('War dodge undone', { warId, beforeStatus });
        return { war };
    }

    /**
     * Revert a finalized war result
     * @param {string} warId
     * @returns {Promise<{war: Object, winner: Object, loser: Object}>}
     */
    async revertResult(warId) {
        const war = await War.findById(warId);
        if (!war) {
            throw new Error('War not found');
        }
        if (war.status !== 'finalizada' || !war.winnerGuildId) {
            throw new Error('War is not finalized or winner missing');
        }

        const winner = await Guild.findById(war.winnerGuildId);
        const loserId = String(war.winnerGuildId) === String(war.guildAId)
            ? war.guildBId
            : war.guildAId;
        const loser = await Guild.findById(loserId);

        if (!winner || !loser) {
            throw new Error('Associated guilds not found');
        }

        winner.wins = Math.max(0, (winner.wins || 0) - 1);
        loser.losses = Math.max(0, (loser.losses || 0) - 1);

        war.status = 'aberta';
        war.winnerGuildId = null;

        await Promise.all([winner.save(), loser.save(), war.save()]);

        LoggerService.info('War result reverted', { warId });
        return { war, winner, loser };
    }
}

module.exports = new WarService();
