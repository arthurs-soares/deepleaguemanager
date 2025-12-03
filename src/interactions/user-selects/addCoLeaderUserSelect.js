const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const {
  ContainerBuilder,
  TextDisplayBuilder,
  SeparatorBuilder
} = require('@discordjs/builders');
const {
  createErrorEmbed
} = require('../../utils/embeds/embedBuilder');
const Guild = require('../../models/guild/Guild');
const { isGuildLeader } = require('../../utils/guilds/guildMemberManager');
const { isGuildAdmin } = require('../../utils/core/permissions');
const { colors, emojis } = require('../../config/botConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * User Select handler to promote co-leader
 * CustomId: add_co_leader_user_select:<guildId>
 */
async function handle(interaction) {
  try {
    const [, guildId] = interaction.customId.split(':');
    const userId = interaction.values?.[0];
    if (!guildId || !userId) return interaction.deferUpdate();

    const guildDoc = await Guild.findById(guildId);
    if (!guildDoc) {
      const embed = createErrorEmbed('Not found', 'Guild not found.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id);
    const admin = await isGuildAdmin(member, interaction.guild.id);
    const isLeader = isGuildLeader(guildDoc, interaction.user.id);
    if (!admin && !isLeader) {
      const embed = createErrorEmbed('Permission denied', 'Only the current leader or a server administrator can add a co-leader.');
      return interaction.reply({ components: [embed], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }

    // Check if selected user is the guild leader
    if (isGuildLeader(guildDoc, userId)) {
      const embed = createErrorEmbed(
        'Invalid selection',
        'The guild leader cannot be selected as co-leader.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Validate if already co-leader
    const members = Array.isArray(guildDoc.members) ? [...guildDoc.members] : [];
    const existing = members.find(m => m.userId === userId);
    if (existing && existing.role === 'vice-lider') {
      const embed = createErrorEmbed(
        'Already co-leader',
        'This user is already a co-leader in the guild.'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Add as member if not already in members array (no roster requirement)
    if (!existing) {
      let username = userId;
      try {
        const user = await interaction.client.users.fetch(userId);
        username = user?.username || username;
      } catch (_) {}
      const newMember = {
        userId,
        username,
        role: 'membro',
        joinedAt: new Date()
      };
      guildDoc.members = [...members, newMember];
    }

    // Limitar número máximo de co-líderes (1)
    const coCount = (guildDoc.members || [])
      .filter(m => m.role === 'vice-lider').length;

    if (coCount >= 1) {
      const embed = createErrorEmbed(
        'Limit reached',
        'The guild already has the maximum number of co-leaders (1).'
      );
      return interaction.reply({
        components: [embed],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    // Fetch user info for confirmation
    let targetUser = null;
    try {
      targetUser = await interaction.client.users.fetch(userId);
    } catch (_) { /* ignore */ }

    const username = targetUser?.username || userId;

    // Build confirmation message
    const container = new ContainerBuilder();
    const warningColor = typeof colors.warning === 'string'
      ? parseInt(colors.warning.replace('#', ''), 16)
      : colors.warning;
    container.setAccentColor(warningColor);

    const titleText = new TextDisplayBuilder()
      .setContent(`# ${emojis.warning || '⚠️'} Confirm Co-leader Promotion`);

    const descText = new TextDisplayBuilder()
      .setContent(
        `Are you sure you want to promote the following user ` +
        `to **Co-leader** of **${guildDoc.name}**?`
      );

    const userText = new TextDisplayBuilder()
      .setContent(
        `**User:** <@${userId}>\n` +
        `**Username:** ${username}`
      );

    container.addTextDisplayComponents(titleText);
    container.addSeparatorComponents(new SeparatorBuilder());
    container.addTextDisplayComponents(descText);
    container.addTextDisplayComponents(userText);

    const confirmBtn = new ButtonBuilder()
      .setCustomId(`coLeader:addConfirm:${guildId}:${userId}:yes`)
      .setLabel('Confirm')
      .setStyle(ButtonStyle.Success);

    const cancelBtn = new ButtonBuilder()
      .setCustomId(`coLeader:addConfirm:${guildId}:${userId}:no`)
      .setLabel('Cancel')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);

    return interaction.reply({
      components: [container, row],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  } catch (error) {
    LoggerService.error('Error in addCoLeaderUserSelect:', { error });
    const container = createErrorEmbed(
      'Error',
      'Could not complete co-leader promotion.'
    );
    if (interaction.deferred || interaction.replied) {
      return interaction.followUp({
        components: [container],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }
    return interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }
}

module.exports = { handle };

