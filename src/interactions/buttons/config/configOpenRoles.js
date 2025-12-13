const { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags } = require('discord.js');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder } = require('@discordjs/builders');
const { colors } = require('../../../config/botConfig');
const { getOrCreateRoleConfig } = require('../../../utils/misc/roleConfig');
const LoggerService = require('../../../services/LoggerService');

/**
 * Opens roles panel
 * CustomId: config:roles
 */
async function handle(interaction) {
  try {
    const cfg = await getOrCreateRoleConfig(interaction.guild.id);

    const container = new ContainerBuilder();
    const primaryColor = typeof colors.primary === 'string'
      ? parseInt(colors.primary.replace('#', ''), 16)
      : colors.primary;
    container.setAccentColor(primaryColor);

    const titleText = new TextDisplayBuilder()
      .setContent('# ⚙️ Configure Roles');

    const descText = new TextDisplayBuilder()
      .setContent('Select a role type from the dropdown menu below to configure it.');

    const rolesText = new TextDisplayBuilder()
      .setContent(
        `**Leaders:** ${cfg.leadersRoleId ? `<@&${cfg.leadersRoleId}>` : '—'}\n` +
        `**Co-leaders:** ${cfg.coLeadersRoleId ? `<@&${cfg.coLeadersRoleId}>` : '—'}\n` +
        `**Managers:** ${cfg.managersRoleId ? `<@&${cfg.managersRoleId}>` : '—'}\n` +
        `**Moderators:** ${cfg.moderatorsRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
        `**Hosters:** ${cfg.hostersRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
        `**Support:** ${cfg.supportRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
        `**Admin Support:** ${cfg.adminSupportRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
        `**Registration Access:** ${cfg.registrationAccessRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}\n` +
        `**No Wagers:** ${cfg.noWagersRoleId ? `<@&${cfg.noWagersRoleId}>` : '—'}\n` +
        `**Blacklist:** ${cfg.blacklistRoleIds?.map(id => `<@&${id}>`).join(', ') || '—'}`
      );

    container.addTextDisplayComponents(titleText, descText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(rolesText);

    // Create dropdown menu for role configuration
    const roleSelect = new StringSelectMenuBuilder()
      .setCustomId('config:roles:select')
      .setPlaceholder('Select a role type to configure')
      .addOptions([
        // 👑 Leadership Roles
        new StringSelectMenuOptionBuilder()
          .setLabel('Leaders Role')
          .setDescription('Role for guild leaders')
          .setValue('leader')
          .setEmoji('👑'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Co-leaders Role')
          .setDescription('Role for guild co-leaders')
          .setValue('coLeader')
          .setEmoji('👑'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Managers Role')
          .setDescription('Role for guild managers')
          .setValue('manager')
          .setEmoji('👑'),


        // 🛡️ Staff Roles
        new StringSelectMenuOptionBuilder()
          .setLabel('Moderators Roles')
          .setDescription('Roles for server moderators (multiple selection)')
          .setValue('moderators')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Hosters Roles')
          .setDescription('Roles for event hosters (multiple selection)')
          .setValue('hosters')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Support Roles')
          .setDescription('Roles for support staff (multiple selection)')
          .setValue('support')
          .setEmoji('🛡️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Admin Support Roles')
          .setDescription('Roles for admin support (multiple selection)')
          .setValue('adminSupport')
          .setEmoji('🛡️'),

        // 📝 Access Roles
        new StringSelectMenuOptionBuilder()
          .setLabel('Registration Access Roles')
          .setDescription('Roles that can create roster tickets (multiple)')
          .setValue('registrationAccess')
          .setEmoji('📝'),

        // 🚫 Restriction Roles
        new StringSelectMenuOptionBuilder()
          .setLabel('No Wagers Role')
          .setDescription('Role that restricts users from creating wagers')
          .setValue('noWagers')
          .setEmoji('🚫'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Blacklist Role')
          .setDescription('Role that restricts users from using any wager/war features')
          .setValue('blacklist')
          .setEmoji('⛔')
      ]);

    const row = new ActionRowBuilder().addComponents(roleSelect);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error opening roles panel:', { error: error?.message });
    const msg = { content: '❌ Could not open the roles panel.', flags: MessageFlags.Ephemeral };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

