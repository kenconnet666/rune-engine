/** 界面的英文文案：和 zh.ts 一一对应 */
import type { ClientText } from './zh.ts';

export const en: ClientText = {
  list: (names) => names.join(', '),

  app: {
    mapLabel: 'World map: drag to pan, scroll or pinch to zoom, click a region for details',
    guest: (room, path) =>
      `Joined room ${room} (${path}); the host runs on the other player's side.`,
    guestAway:
      'Lost the connection to the host; reconnecting… The picture is frozen where it dropped.',
    resumed: (days, ms) =>
      `This game was resumed by replaying its record: ${days} days in ${ms} ms.`,
    disclaimer:
      'Numbers are still being tuned: routes are modelled, and the pathogen is not any real disease.',
    renderLost: (reason) => `The picture dropped out and is recovering: ${reason}`,
    infection: 'Infection',
    reported: 'Reported',
  },

  status: {
    waiting: 'Waiting for the host…',
    attacker: 'Pathogen · true picture',
    defender: 'Response · reported picture',
    day: (day) => `Day ${day}`,
    infections: 'Infected now',
    cases: 'Cases now (est.)',
    deaths: 'Deaths',
    regions: 'Regions',
    points: 'Mutation points',
    budget: 'Budget',
    perDay: (net) => `${net} per day`,
    calamityAttacker: 'Calamity (fill it to win)',
    calamityDefender: 'Calamity (full means defeat; from reported deaths)',
    trust: 'Public trust',
    compliance: (share) => `measures at ${share}`,
  },

  trend: {
    title: 'Trend',
    infected: 'Total infected',
    reported: 'Total reported',
  },

  news: {
    title: 'News',
    empty: 'Nothing to report yet.',
    day: (day) => `Day ${day}`,
    spread: (place) => `Infection appears in ${place}`,
    report: (place) => `${place} reports its first case`,
    evolved: (name) => `New trait: ${name}`,
    evolvedSeen: (name) => `The pathogen shows a new trait: ${name}`,
    research: (name) => `Research complete: ${name}`,
    vaccine: 'Vaccination begins everywhere',
    traced: (place) => `Origin traced to ${place}`,
    eventAt: (place, name) => `${place}: ${name}`,
  },

  region: {
    deselect: 'Deselect',
    population: (year) => `Population (${year})`,
    immune: 'Vaccinated',
    conditions: 'Conditions',
    routes: 'Routes',
    routeCounts: (land, air, sea) => `Land ${land} · Air ${air} · Sea ${sea}`,
    gathering: 'A mass gathering is under way here.',
    disaster: 'A natural disaster has struck here.',
    measures: 'Measures',
    measuresOn: (count) => `${count} active`,
    defenderHere: (names) => `The response here: ${names}`,
    defenderNone: 'The response has taken no measures here yet.',
    daily: (cost) => `${cost} per day`,
    setup: (cost) => `${cost} to start`,
    measureHint: (name, detail, setup, daily) =>
      `${name}: ${detail} (${setup} to start, then ${daily} per day)`,
  },

  pathogen: {
    title: 'Pathogen',
    traits: (count) => `${count} traits`,
    unknown:
      'You know nothing about it yet: finish “Pathogen identification” to see its routes and every mutation.',
    owned: (names) => `Has: ${names}`,
    none: 'No traits yet.',
    evolve: 'Evolve',
    affordable: (count) => `${count} affordable`,
    points: (count) => `${count} pts`,
  },

  research: {
    title: 'Research',
    progress: (done, total) => `${done} / ${total} done`,
    vaccinating: 'The vaccine is in production and being given everywhere.',
    remaining: (days) => `${days} days left`,
    none: 'No research started yet.',
    done: (names) => `Done: ${names}`,
    open: 'Plan research',
    busy: 'All labs are busy',
    free: (count) => `${count} labs free`,
  },

  workbench: {
    evolveTitle: 'Evolution',
    researchTitle: 'Research',
    pick: 'Select a tile to see what it is.',
    owned: 'Already acquired',
    done: 'Already complete',
    inProgress: (days) => `In progress: ${days} days left`,
    locked: 'Prerequisites not met',
    requiresAny: (names) => `Needs one of: ${names}`,
    requiresAll: (names) => `Needs: ${names}`,
    effects: 'Effects',
    cost: 'Cost',
    points: (count) => `${count} pts`,
    budget: (cost, days) => `Budget ${cost} · ${days} days`,
    evolve: 'Acquire this trait',
    research: 'Start research',
    cannotAfford: 'Not enough yet',
    labsBusy: 'All labs are busy: wait for one to finish.',
    days: (count) => `${count} days`,
    yes: 'yes',
  },

  opponent: {
    human: 'Opponent · another player',
    ai: 'Opponent · computer',
    room: (room, path) => `Room ${room} · ${path}`,
    waiting: (room) =>
      `Room ${room} is open, waiting for the other player; the computer plays until then.`,
    away: 'The other player dropped out and time is paused. Wait for them, or let the computer take over.',
    hostAway: 'Lost the connection to the host; reconnecting…',
    level: 'Computer difficulty',
    levels: ['Easy', 'Normal', 'Hard'],
    online: 'Play together',
    handOver: 'Let the computer take over',
  },

  lobby: {
    title: 'Play together',
    intro:
      'Two players, one side each. The game runs on the side of whoever opens the room; the other player opens the invite link, or types the room code in their own main menu.',
    localOnly:
      'This build has no online service: the room can only be joined from another tab of this same browser.',
    open: 'Open a room',
    close: 'Close the room',
    code: 'Room code',
    link: 'Invite link',
    copy: 'Copy link',
    copied: 'Copied',
    side: 'I play as',
    states: {
      connecting: 'Connecting to the room…',
      waiting: 'The room is open, waiting for the other player.',
      joined: 'The other player is here.',
      away: 'The other player dropped out: time is paused. Wait for them, or let the computer take over.',
      closed: 'The room is closed.',
    },
    paths: { relay: 'relayed by the server', direct: 'direct' },
    reasons: {
      taken: 'This room code is in use by someone else.',
      full: 'The room already has two players.',
      missing: 'No such room: the code is wrong, or the host left a long time ago.',
      replaced: 'The same identity joined from another page, so this page stepped aside.',
      invalid: 'The two sides run different versions; reload the page and try again.',
      left: 'You left the room.',
    },
    join: "Join someone else's room",
    joinGo: 'Join',
    badCode: 'A room code is 4–8 letters and digits.',
  },

  joining: {
    title: (room) => `Joining room ${room}`,
    connecting: 'Connecting…',
    waiting:
      'The room exists but the host is away: hold on, it reconnects as soon as they are back.',
    leave: 'Stop waiting and start my own game',
  },

  controls: {
    time: 'Time',
    pause: 'Pause',
    speed: (times) => `${times}× speed`,
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fit: 'Show the whole map',
    role: 'Play as',
    attacker: 'Pathogen',
    defender: 'Response',
    restart: 'New game',
    language: 'Language',
  },

  menu: {
    name: 'Bewilderment',
    poem: 'A bewilderment too slight to fill a hand; from it an evil thought is born, crawls across the wilds, climbs over the hills, and sows calamity across the sky.',
    about: 'A strategy game about how infectious diseases spread, and how they are stopped.',
    resume: 'Continue this game',
    newGame: 'New game',
    online: 'Play together',
    saves: 'Saves and replays',
    encyclopedia: 'Encyclopedia',
    settings: 'Settings',
    open: 'Menu',
    leaveRoom: 'Leave the room',
  },

  saves: {
    title: 'Saves and replays',
    saveCurrent: 'Save this game',
    exportCurrent: 'Export this game',
    importFile: 'Import a record file',
    saved: 'Saved.',
    full: 'Could not save: browser storage is full. Delete some older saves and try again.',
    incompatible: 'This save was played on a different data version and can no longer be replayed.',
    badFile:
      'This file is not a usable game record (or it was played on a different data version).',
    slots: (count, limit) => `Save slots ${count} / ${limit} (the oldest is dropped when full)`,
    empty: 'No saves yet.',
    load: 'Load and keep playing',
    watch: 'Replay from the start',
    export: 'Export to a file',
    delete: 'Delete',
  },

  playback: {
    title: 'Replay',
    progress: (day, total) => `Day ${day} of ${total}`,
    exit: 'Exit replay',
    note: 'Replaying: you can watch but not act.',
  },

  encyclopedia: {
    title: 'Encyclopedia',
    pathogens: 'Pathogens',
    traits: 'Traits',
    measures: 'Regional measures',
    techs: 'Research',
    cost: 'Cost',
    requires: 'Requires',
    none: 'nothing',
    upkeep: (cost) => `${cost} per day in a region of 50 million, scaled by population`,
    research: (cost, days) => `Budget ${cost} · ${days} days`,
  },

  settings: {
    title: 'Settings',
    language: 'Language',
    volume: 'Volume',
    volumes: {
      master: 'Master',
      music: 'Music',
      ambience: 'Ambience',
      alert: 'Alerts',
      ui: 'Interface',
    },
    credits: 'Data and assets',
    creditLines: [
      'Borders, population, economy: Natural Earth (public domain), borders prepared by world-atlas',
      'Chinese place names: i18n-iso-countries (MIT)',
      'Icons: lucide (ISC), plus a few drawn for this project',
      'Disease facts: public pages of the World Health Organization and the US CDC, cited in each pathogen entry',
      'Air and sea routes are a model based on population, economy and distance, not real flight or shipping data',
    ],
    license:
      'This game is an open-source personal learning project (MIT licence), not for commercial release.',
  },

  setup: {
    title: 'New game',
    pathogen: 'Pathogen',
    side: 'You play',
    level: 'Computer difficulty',
    facts: 'About the real disease',
    play: 'In this game',
    sources: 'Sources',
    note: "The game's numbers follow the character of the real disease; they are not its real parameters.",
    start: 'Start',
  },

  outcome: {
    title: (day) => `Day ${day} · game over`,
    won: 'You won',
    lost: 'You lost',
    infected: 'Total infected',
    reported: 'Total reported',
    deaths: 'Deaths',
    regions: 'Regions reached',
    traits: 'Pathogen traits',
    unknown: 'unknown',
    techs: 'Research completed',
    trust: 'Public trust',
    economy: 'Economic loss',
    restart: 'New game',
  },
};
