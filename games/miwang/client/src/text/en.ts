/** 界面的英文文案：和 zh.ts 一一对应 */
import type { ClientText } from './zh.ts';

export const en: ClientText = {
  list: (names) => names.join(', '),

  app: {
    mapLabel: 'World map: drag to pan, scroll or pinch to zoom, click a region for details',
    guest: (room) => `Joined room ${room}; the host runs on the other player's side.`,
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
    room: (room) => `Room ${room}: both players are here.`,
    level: 'Computer difficulty',
    levels: ['Easy', 'Normal', 'Hard'],
    invite: 'Invite another player',
    inviteHelp:
      'Open this address in another tab on this computer (same browser only for now; network play is not built yet):',
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
