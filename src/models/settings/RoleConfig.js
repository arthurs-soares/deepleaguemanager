const mongoose = require('mongoose');

/**
 * Role configurations per server
 */
const roleConfigSchema = new mongoose.Schema({
  discordGuildId: { type: String, required: true, index: true, unique: true },
  leadersRoleId: { type: String, default: null },
  coLeadersRoleId: { type: String, default: null },
  managersRoleId: { type: String, default: null },
  moderatorsRoleIds: { type: [String], default: [] },
  hostersRoleIds: { type: [String], default: [] },
  supportRoleIds: { type: [String], default: [] },
  adminSupportRoleIds: { type: [String], default: [] },
  tagRoleId: { type: String, default: null },
  registrationAccessRoleIds: { type: [String], default: [] },
  noWagersRoleId: { type: String, default: null },
  blacklistRoleIds: { type: [String], default: [] },
}, { timestamps: true });

module.exports = mongoose.models.RoleConfig || mongoose.model('RoleConfig', roleConfigSchema);

