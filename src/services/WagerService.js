const { createErrorEmbed } = require('../utils/embeds/embedBuilder');
const { auditAdminAction } = require('../utils/misc/adminAudit');
const { getOrCreateUserProfile } = require('../utils/user/userProfile');
const { updateRanksAfterWager } = require('./rankService');
const LoggerService = require('./LoggerService');
const {
  buildWagerResultContainer,
  buildWagerResult2v2Container
} = require('../utils/embeds/wagerResultEmbed');

/**
 * Service for Wager related business logic
 */
class WagerService {
  /**
     * Helper to fetch a user from client
     * @param {import('discord.js').Client} client
     * @param {string} userId
     */
  async getUser(client, userId) {
    try { return await client.users.fetch(userId); } catch (_) { return null; }
  }

  /**
     * Record a wager result
     * @param {import('discord.js').Guild} discordGuild
     * @param {string} actorId
     * @param {string} winnerId
     * @param {string} loserId
     * @param {import('discord.js').Client} client
     */
  async recordWager(discordGuild, actorId, winnerId, loserId, client) {
    if (!winnerId || !loserId || winnerId === loserId) {
      return createErrorEmbed('Invalid users', 'Winner and loser must be different valid users.');
    }

    try {
      const winnerProfile = await getOrCreateUserProfile(winnerId);
      this._updateWinnerStats(winnerProfile);
      await winnerProfile.save();

      const loserProfile = await getOrCreateUserProfile(loserId);
      this._updateLoserStats(loserProfile);
      await loserProfile.save();

      try {
        await updateRanksAfterWager(discordGuild, winnerId, winnerProfile.wagerWins);
      } catch (err) {
        LoggerService.warn('Failed to update ranks after wager', { userId: winnerId, error: err.message });
      }

      const [wUser, lUser] = await Promise.all([
        this.getUser(client, winnerId),
        this.getUser(client, loserId)
      ]);

      try {
        await auditAdminAction(discordGuild, actorId, 'Wager Result Recorded', {
          targetUserId: winnerId,
          extra: `Winner: ${wUser?.tag || winnerId}, Loser: ${lUser?.tag || loserId}`
        });
      } catch (err) {
        LoggerService.warn('Failed to audit wager action', { error: err.message });
      }

      LoggerService.info('Wager recorded', { winnerId, loserId, actorId });

      return buildWagerResultContainer(
        actorId,
        winnerId,
        loserId,
        wUser,
        lUser,
        winnerProfile,
        loserProfile
      );

    } catch (error) {
      LoggerService.error('Error recording wager', { error: error.message });
      throw error;
    }
  }

  /**
     * Record a 2v2 wager result
     * @param {import('discord.js').Guild} discordGuild
     * @param {string} actorId
     * @param {string[]} winnerIds
     * @param {string[]} loserIds
     * @param {import('discord.js').Client} client
     */
  async recordWager2v2(discordGuild, actorId, winnerIds, loserIds, client) {
    if (!winnerIds?.length || !loserIds?.length || winnerIds.length !== 2 || loserIds.length !== 2) {
      return createErrorEmbed('Invalid teams', 'Both teams must have exactly 2 players.');
    }

    const uniqueIds = new Set([...winnerIds, ...loserIds]);
    if (uniqueIds.size !== 4) {
      return createErrorEmbed('Invalid participants', 'All 4 participants must be unique users.');
    }

    try {
      const processWinner = async (winnerId) => {
        const profile = await getOrCreateUserProfile(winnerId);
        this._updateWinnerStats(profile);
        await profile.save();

        try {
          // No await here either? No, we likely want this awaited or handled by the service's background logic
          // rankService.updateRanksAfterWager now handles backgrounding the heavy part
          await updateRanksAfterWager(discordGuild, winnerId, profile.wagerWins);
        } catch (err) {
          LoggerService.warn('Failed to update ranks after 2v2 wager', { userId: winnerId, error: err.message });
        }
        return profile;
      };

      const processLoser = async (loserId) => {
        const profile = await getOrCreateUserProfile(loserId);
        this._updateLoserStats(profile);
        await profile.save();
        return profile;
      };

      const [winnerProfiles, loserProfiles] = await Promise.all([
        Promise.all(winnerIds.map(processWinner)),
        Promise.all(loserIds.map(processLoser))
      ]);

      const [w1, w2, l1, l2] = await Promise.all([
        this.getUser(client, winnerIds[0]),
        this.getUser(client, winnerIds[1]),
        this.getUser(client, loserIds[0]),
        this.getUser(client, loserIds[1])
      ]);
      const winnerUsers = [w1, w2];
      const loserUsers = [l1, l2];

      try {
        await auditAdminAction(discordGuild, actorId, '2v2 Wager Result Recorded', {
          targetUserId: winnerIds[0],
          extra: `Winners: ${w1?.tag || winnerIds[0]} & ${w2?.tag || winnerIds[1]}, Losers: ${l1?.tag || loserIds[0]} & ${l2?.tag || loserIds[1]}`
        });
      } catch (err) {
        LoggerService.warn('Failed to audit 2v2 wager action', { error: err.message });
      }

      LoggerService.info('2v2 Wager recorded', { winnerIds, loserIds, actorId });

      return buildWagerResult2v2Container(
        actorId,
        winnerIds,
        loserIds,
        winnerUsers,
        loserUsers,
        winnerProfiles,
        loserProfiles
      );

    } catch (error) {
      LoggerService.error('Error recording 2v2 wager', { error: error.message });
      throw error;
    }
  }

  _updateWinnerStats(profile) {
    profile.wagerGamesPlayed = (profile.wagerGamesPlayed || 0) + 1;
    profile.wagerWins = (profile.wagerWins || 0) + 1;
    profile.wagerWinStreak = (profile.wagerWinStreak || 0) + 1;
    profile.wagerLossStreak = 0;
    if (profile.wagerWinStreak > (profile.wagerMaxWinStreak || 0)) {
      profile.wagerMaxWinStreak = profile.wagerWinStreak;
    }
  }

  _updateLoserStats(profile) {
    profile.wagerGamesPlayed = (profile.wagerGamesPlayed || 0) + 1;
    profile.wagerLosses = (profile.wagerLosses || 0) + 1;
    profile.wagerLossStreak = (profile.wagerLossStreak || 0) + 1;
    profile.wagerWinStreak = 0;
  }
}

module.exports = new WagerService();
