const Guild = require('../../models/guild/Guild');
const { normalizeRoleToPortuguese } = require('../core/roleMapping');
const { ensureRegionsArray } = require('./guildDocHelpers');

/**
 * Guild member management utilities
 * - Uniqueness rules: only 1 leader and 1 co-leader
 * - Provides functions to check leadership and transfer leadership
 */

/**
 * Check if the user is the guild leader
 * Checks members array for role='lider' and falls back to registeredBy
 * @param {object} guildDoc - Guild document
 * @param {string} userId - Discord user ID
 * @returns {boolean}
 */
function isGuildLeader(guildDoc, userId) {
  if (!guildDoc || !userId) return false;

  // Check if they are in members with role='lider'
  const members = Array.isArray(guildDoc.members) ? guildDoc.members : [];
  const isLeaderInMembers = members.some(
    m => String(m.userId) === String(userId) && m.role === 'lider'
  );

  if (isLeaderInMembers) return true;

  // Fallback: check registeredBy for legacy guilds without members array
  if (guildDoc.registeredBy === userId) {
    // If no leader in members, registeredBy is the leader
    const hasLeaderInMembers = members.some(m => m.role === 'lider');
    if (!hasLeaderInMembers) return true;
  }

  return false;
}

/**
 * Check if the user is the guild co-leader
 * @param {object} guildDoc - Guild document
 * @param {string} userId - Discord user ID
 * @returns {boolean}
 */
function isGuildCoLeader(guildDoc, userId) {
  if (!guildDoc || !userId) return false;
  const members = Array.isArray(guildDoc.members) ? guildDoc.members : [];
  return members.some(m => String(m.userId) === String(userId) && m.role === 'vice-lider');
}

/**
 * Check if the user is a guild manager
 * @param {object} guildDoc - Guild document
 * @param {string} userId - Discord user ID
 * @returns {boolean}
 */
function isGuildManager(guildDoc, userId) {
  if (!guildDoc || !userId) return false;
  const managers = Array.isArray(guildDoc.managers) ? guildDoc.managers : [];
  return managers.some(id => String(id) === String(userId));
}

/**
 * Get user's role level in the guild hierarchy
 * Leader = 3, Co-leader = 2, Manager = 1, Member/None = 0
 * @param {object} guildDoc - Guild document
 * @param {string} userId - Discord user ID
 * @returns {number}
 */
function getUserRoleLevel(guildDoc, userId) {
  if (!guildDoc || !userId) return 0;
  if (isGuildLeader(guildDoc, userId)) return 3;
  if (isGuildCoLeader(guildDoc, userId)) return 2;
  if (isGuildManager(guildDoc, userId)) return 1;
  return 0;
}

/**
 * Get role level by userId (for target user in roster)
 * @param {object} guildDoc - Guild document
 * @param {string} targetUserId - Target user ID to check
 * @returns {number}
 */
function getTargetRoleLevel(guildDoc, targetUserId) {
  if (!guildDoc || !targetUserId) return 0;
  if (isGuildLeader(guildDoc, targetUserId)) return 3;
  if (isGuildCoLeader(guildDoc, targetUserId)) return 2;
  if (isGuildManager(guildDoc, targetUserId)) return 1;
  return 0;
}

/**
 * Check if user can manage (add/remove) the target user
 * Rule: Can only manage users with LOWER role level
 * @param {object} guildDoc - Guild document
 * @param {string} actorId - User performing the action
 * @param {string} targetId - User being affected
 * @returns {boolean}
 */
function canManageUser(guildDoc, actorId, targetId) {
  const actorLevel = getUserRoleLevel(guildDoc, actorId);
  const targetLevel = getTargetRoleLevel(guildDoc, targetId);
  // Can only manage users with strictly lower level
  return actorLevel > targetLevel;
}

/**
 * Busca um membro por userId
 * @param {object} guildDoc
 * @param {string} userId
 */
function findMember(guildDoc, userId) {
  return (Array.isArray(guildDoc?.members) ? guildDoc.members : []).find(m => m.userId === userId);
}

/**
 * Transfer leadership to a new user
 * Ensures only one member has role='lider'.
 * @param {string} guildId - Guild document ID
 * @param {string} newLeaderId - New leader ID
 * @param {string} newLeaderName - New leader display name
 * @returns {Promise<{success:boolean, message:string, guild?:object}>}
 */
async function transferLeadership(guildId, newLeaderId, newLeaderName) {
  try {
    const doc = await Guild.findById(guildId);
    if (!doc) return { success: false, message: 'Guild not found.' };

    const members = Array.isArray(doc.members) ? [...doc.members] : [];

    // Demote any current leader to 'membro'
    for (const m of members) {
      if (normalizeRoleToPortuguese(m.role) === 'lider') {
        m.role = 'membro';
      }
    }

    // Ensure the new leader is in the members list
    let target = members.find(m => m.userId === newLeaderId);
    if (!target) {
      target = {
        userId: newLeaderId,
        username: newLeaderName,
        role: 'membro',
        joinedAt: new Date(),
      };
      members.push(target);
    }

    // Promote to leader
    target.role = 'lider';

    // Update fields
    doc.members = members;
    if (newLeaderName) doc.leader = newLeaderName;

    // Ensure regions array is valid before save (legacy migration)
    ensureRegionsArray(doc);

    const saved = await doc.save();
    return { success: true, message: 'Leadership transferred successfully.', guild: saved };
  } catch (error) {
    console.error('Error transferring leadership:', error);
    return { success: false, message: 'Internal error transferring leadership.' };
  }
}

/**
 * Ensures the guild has a leader in the members array
 * @param {object} guildDoc - Guild document
 * @param {string} leaderName - Leader name to display
 * @param {string} leaderId - Leader user ID (required)
 * @returns {object} - Updated document
 */
function ensureLeaderInMembers(guildDoc, leaderName, leaderId) {
  if (!guildDoc || !leaderId) return guildDoc;

  const members = Array.isArray(guildDoc.members) ? [...guildDoc.members] : [];

  // Check if already exists as leader
  const existingLeader = members.find(m => m.userId === leaderId && m.role === 'lider');
  if (existingLeader) return guildDoc;

  // Remove any previous entry of this user
  const filtered = members.filter(m => m.userId !== leaderId);

  // Add as leader
  filtered.push({
    userId: leaderId,
    username: leaderName || guildDoc.leader || leaderId,
    role: 'lider',
    joinedAt: new Date(),
  });

  guildDoc.members = filtered;
  return guildDoc;
}


module.exports = {
  isGuildLeader,
  isGuildCoLeader,
  isGuildManager,
  getUserRoleLevel,
  getTargetRoleLevel,
  canManageUser,
  transferLeadership,
  findMember,
  ensureLeaderInMembers,
};

