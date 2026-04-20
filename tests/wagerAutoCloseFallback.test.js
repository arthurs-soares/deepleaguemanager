const assert = require('assert');
const Module = require('module');
const path = require('path');

const subjectPath = path.join(__dirname, '..', 'src', 'utils', 'tickets', 'wagerAutoClose.js');

function loadSubject(mocks) {
  const originalLoad = Module._load;

  Module._load = function patchedLoad(request, parent, isMain) {
    if (Object.prototype.hasOwnProperty.call(mocks, request)) {
      return mocks[request];
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[require.resolve(subjectPath)];

  try {
    return require(subjectPath);
  } finally {
    Module._load = originalLoad;
  }
}

async function runWithImmediateTimers(fn) {
  const originalSetTimeout = global.setTimeout;
  const pending = [];

  global.setTimeout = (callback) => {
    try {
      const result = callback();
      if (result && typeof result.then === 'function') {
        pending.push(result);
      }
    } catch (error) {
      pending.push(Promise.reject(error));
    }
    return 0;
  };

  try {
    await fn();
    await Promise.all(pending);
  } finally {
    global.setTimeout = originalSetTimeout;
  }
}

function createLogger() {
  return {
    info() {},
    warn() {},
    error() {}
  };
}

function createGuild(channel) {
  return {
    id: 'guild-1',
    channels: {
      cache: {
        get() {
          return null;
        }
      },
      async fetch(channelId) {
        assert.strictEqual(channelId, channel.id);
        return channel;
      }
    }
  };
}

function createClient(guild) {
  return {
    user: { id: 'bot-user' },
    guilds: {
      cache: new Map([[guild.id, guild]])
    },
    users: {
      async fetch() {
        return null;
      }
    }
  };
}

function createChannel(id) {
  const sent = [];
  const deletes = [];

  return {
    channel: {
      id,
      type: 'GuildText',
      async send(payload) {
        sent.push(payload);
      },
      async delete(reason) {
        deletes.push(reason);
      }
    },
    sent,
    deletes
  };
}

async function testUnacceptedTicketUsesFetchedChannel() {
  const channelState = createChannel('channel-1');
  const guild = createGuild(channelState.channel);
  const client = createClient(guild);
  const saveCalls = [];

  const ticket = {
    _id: 'ticket-1',
    discordGuildId: guild.id,
    channelId: channelState.channel.id,
    initiatorUserId: 'user-a',
    opponentUserId: 'user-b',
    status: 'open',
    acceptedAt: null,
    createdAt: new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)),
    async save() {
      saveCalls.push({
        status: this.status,
        closedAt: this.closedAt,
        closedByUserId: this.closedByUserId
      });
    }
  };

  const { scanExpiredWagerTickets } = loadSubject({
    'discord.js': {
      ChannelType: { GuildText: 'GuildText' },
      MessageFlags: { IsComponentsV2: 1 },
      ActionRowBuilder: class {},
      ButtonBuilder: class {},
      ButtonStyle: {}
    },
    '../../models/wager/WagerTicket': {
      find: async () => [ticket]
    },
    '../embeds/wagerDodgeEmbed': {
      buildWagerDodgeEmbed: async () => ({ container: null, attachment: null })
    },
    './wagerDodgeLog': {
      sendWagerDodgeLog: async () => {}
    },
    './transcript': {
      sendTranscriptToLogs: async () => true
    },
    '../../services/LoggerService': createLogger()
  });

  await runWithImmediateTimers(async () => {
    await scanExpiredWagerTickets(client);
  });

  assert.strictEqual(saveCalls.length, 1);
  assert.strictEqual(saveCalls[0].status, 'closed');
  assert.strictEqual(channelState.deletes.length, 1);
  assert.strictEqual(channelState.deletes[0], 'Auto-closed: 24h unaccepted');
}

async function testAcceptedTicketUsesFetchedChannel() {
  const channelState = createChannel('channel-2');
  const guild = createGuild(channelState.channel);
  const client = createClient(guild);
  const saveCalls = [];

  const ticket = {
    _id: 'ticket-2',
    discordGuildId: guild.id,
    channelId: channelState.channel.id,
    initiatorUserId: 'user-a',
    opponentUserId: 'user-b',
    status: 'open',
    acceptedAt: new Date(Date.now() - (4 * 24 * 60 * 60 * 1000)),
    inactivityReactivatedAt: null,
    lastInactivityWarningAt: null,
    async save() {
      saveCalls.push({
        status: this.status,
        dodgedByUserId: this.dodgedByUserId,
        closedAt: this.closedAt,
        closedByUserId: this.closedByUserId
      });
    }
  };

  const acceptedSubject = loadSubject({
    'discord.js': {
      ChannelType: { GuildText: 'GuildText' },
      MessageFlags: { IsComponentsV2: 1 },
      ActionRowBuilder: class {},
      ButtonBuilder: class {},
      ButtonStyle: {}
    },
    '../../models/wager/WagerTicket': {
      find: async (query) => {
        if (query.acceptedAt && Object.prototype.hasOwnProperty.call(query.acceptedAt, '$ne')) {
          return [ticket];
        }
        return [];
      }
    },
    '../embeds/wagerDodgeEmbed': {
      buildWagerDodgeEmbed: async () => ({ container: null, attachment: null })
    },
    './wagerDodgeLog': {
      sendWagerDodgeLog: async () => {}
    },
    './transcript': {
      sendTranscriptToLogs: async () => true
    },
    '../../services/LoggerService': createLogger()
  });

  await runWithImmediateTimers(async () => {
    await acceptedSubject.scanExpiredWagerTickets(client);
  });

  assert.strictEqual(saveCalls.length, 1);
  assert.strictEqual(saveCalls[0].status, 'closed');
  assert.strictEqual(saveCalls[0].dodgedByUserId, 'user-b');
  assert.strictEqual(channelState.deletes.length, 1);
  assert.strictEqual(channelState.deletes[0], 'Auto-dodge: 3 days after acceptance');
}

(async () => {
  await testUnacceptedTicketUsesFetchedChannel();
  await testAcceptedTicketUsesFetchedChannel();
  console.log('wagerAutoClose fallback tests passed');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
