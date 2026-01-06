const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} = require('discord.js');
const War = require('../../models/war/War');
const Guild = require('../../models/guild/Guild');
const { getOrCreateRoleConfig } = require('../../utils/misc/roleConfig');
const LoggerService = require('../../services/LoggerService');

/**
 * Handle select for choosing which guild dodged
 * CustomId: war:dodge:select:<warId>:<sourceMessageId>
 */
async function handle(interaction) {
  try {
    const parts = interaction.customId.split(':');
    const warId = parts[3];
    const sourceMessageId = parts[4] && parts[4] !== '0' ? parts[4] : null;
    const dodgerGuildId = interaction.values?.[0];

    if (!warId || !dodgerGuildId) return interaction.deferUpdate();

    // Permissions: only Moderators/Hosters (configured in /config)
    const rolesCfg = await getOrCreateRoleConfig(interaction.guild.id);
    const allowedRoleIds = new Set([...(rolesCfg?.hostersRoleIds || []), ...(rolesCfg?.moderatorsRoleIds || [])]);
    const hasAllowedRole = interaction.member.roles.cache.some(r => allowedRoleIds.has(r.id));
    if (!hasAllowedRole) {
      return interaction.reply({
        content: '❌ Only hosters or moderators can mark a war as dodge.',
        flags: MessageFlags.Ephemeral
      });
    }

    const war = await War.findById(warId);
    if (!war) {
      return interaction.reply({
        content: '❌ War not found.',
        flags: MessageFlags.Ephemeral
      });
    }
    if (war.status !== 'aberta') {
      return interaction.reply({
        content: '⚠️ This war is no longer waiting for confirmation.',
        flags: MessageFlags.Ephemeral
      });
    }

    const [guildA, guildB, dodger] = await Promise.all([
      Guild.findById(war.guildAId),
      Guild.findById(war.guildBId),
      Guild.findById(dodgerGuildId)
    ]);

    const confirm = new ButtonBuilder()
      .setCustomId(`war:dodge:apply:${warId}:${dodgerGuildId}:${sourceMessageId || '0'}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel('Confirm Dodge');
    const cancel = new ButtonBuilder()
      .setCustomId(`war:dodge:cancel:${warId}:${sourceMessageId || '0'}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel('Cancel');
    const row = new ActionRowBuilder().addComponents(confirm, cancel);

    const aName = guildA?.name || 'Guild A';
    const bName = guildB?.name || 'Guild B';
    const dName = dodger?.name || 'Selected Guild';

    return interaction.update({
      content: `You selected: ${dName} dodged the war between ${aName} vs ${bName}.\nDo you confirm?`,
      components: [row]
    });
  } catch (error) {
    LoggerService.error('Error in select war:dodge:select:', error);
    const msg = {
      content: '❌ Could not process the selection.',
      flags: MessageFlags.Ephemeral
    };
    if (interaction.deferred || interaction.replied) return interaction.followUp(msg);
    return interaction.reply(msg);
  }
}

module.exports = { handle };

