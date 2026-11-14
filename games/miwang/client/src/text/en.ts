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
    runway: (net, days) => `${net} per day · lasts ${days} days`,
    calamityAttacker: 'Calamity (fill it to win)',
    calamityDefender: 'Calamity (full means defeat; from reported deaths)',
    trust: 'Public trust',
    compliance: (share) => `measures at ${share}`,
  },

  trend: {
    title: 'Trend',
    infected: 'Total infected',
    reported: 'Total reported',
    ahead: (day) => `at this pace by day ${day}`,
  },

  layers: {
    title: 'What the map shows',
    reportedInfection: 'Reported infection',
    unknown: 'Its routes are still unknown: identify the pathogen first.',
    items: {
      infection: { name: 'Infection', low: 'none', middle: '', high: 'severe' },
      reproduction: {
        name: 'Reproduction number',
        low: 'shrinking',
        middle: '1',
        high: 'growing fast',
      },
      suppression: { name: 'Spread cut by measures', low: 'none', middle: '', high: 'all' },
      strain: { name: 'Strain on care', low: 'spare', middle: '', high: 'overrun' },
      immune: { name: 'Vaccinated', low: 'none', middle: '', high: 'all' },
    },
  },

  rank: {
    title: 'Regions to watch',
    boards: {
      cases: 'Worst',
      growth: 'Rising most',
      reproduction: 'Spreading fastest',
      strain: 'Most strained',
    },
    growthPending: 'A few more days are needed to compare the week.',
    reproductionUnknown: 'Its routes are still unknown: identify the pathogen first.',
    empty: 'No regions on this board right now.',
  },

  alerts: {
    title: 'Notices',
    firstDeath: 'The first death',
    regions: (count) => `${count} regions reached`,
    infected: (count) => `${count} infected in total`,
    reported: (count) => `${count} cases reported in total`,
    calamity: (share) => `The calamity line is past ${share}`,
    strain: (place) => `Care is overrun in ${place}`,
    strainCount: (count) => `Care is overrun in ${count} regions`,
    strainDetail: 'Too many patients: fewer can be saved',
    trust: (level) => `Public trust fell below ${level}`,
    trustDetail: 'The lower the trust, the weaker every measure',
    runway: (days) => `The budget lasts only ${days} more days`,
    vaccine: 'Vaccination has begun',
    identified: 'Pathogen identified: its details are now visible',
    goal: (share) => `The chapter goal is at ${share}`,
    deadline: (days) => `${days} days left in this chapter`,
    traitOwn: (name) => `Acquired: ${name}`,
    traitTheirs: (name) => `The pathogen changed: ${name}`,
    researchOwn: (name) => `Research done: ${name}`,
    researchTheirs: (name) => `The response finished research: ${name}`,
    measure: (place) => `Measures changed in ${place}`,
    measureEffect: (from, to) => `Spread cut ${from} → ${to}`,
    measureUnknown: 'The effect shows once the pathogen is identified',
    measures: (count) => `Measures changed in ${count} regions`,
    crackdown: (place, count) =>
      count > 1
        ? `The response tightened in ${place} and ${count - 1} more`
        : `The response tightened in ${place}`,
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
    reproduction: 'Reproduction number',
    reproductionValue: (value, growing, cut) =>
      `${value} (${growing ? 'growing' : 'shrinking'}) · measures cut ${cut}`,
    strain: 'Strain on care',
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
    chapters: 'Chapters',
    online: 'Play together',
    saves: 'Saves and replays',
    encyclopedia: 'Encyclopedia',
    settings: 'Settings',
    credits: 'About and credits',
    open: 'Menu',
    leaveRoom: 'Leave the room',
  },

  saves: {
    title: 'Saves and replays',
    where: 'Where saves are kept',
    local: 'This device',
    cloud: 'Cloud',
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

  cloud: {
    unavailable: 'This build has no cloud save service.',
    intro:
      'Cloud saves need no account: this device makes a sync code and saves are kept on the server under it; enter the same code on another device and it sees the same saves.',
    enable: 'Turn on cloud saves',
    haveKey: 'Already turned on elsewhere: enter the sync code from that device',
    useKey: 'Use this code',
    badKey: 'A sync code is 24–64 lowercase letters and digits.',
    upload: 'Save this game to the cloud',
    refresh: 'Refresh',
    saved: 'Saved to the cloud.',
    loading: 'Fetching cloud saves…',
    slots: (count, limit) =>
      `Cloud ${count} / ${limit} (the oldest is dropped when full; saves untouched for half a year are cleared)`,
    empty: 'No cloud saves yet.',
    key: 'Sync code',
    keyHelp:
      'The sync code is the key: whoever has it can read and write these saves, so do not post it publicly; if you lose it, it cannot be recovered.',
    copy: 'Copy sync code',
    copied: 'Copied',
    forget: 'Stop using cloud saves on this device',
    failures: {
      unreachable: 'Cannot reach the cloud save service; try again in a moment.',
      unauthorized: 'The sync code is not right.',
      'too-large': 'This game record is too large for the cloud.',
      failed: 'The cloud save service had a problem; try again in a moment.',
    },
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
    palette: 'Colours',
    palettes: { standard: 'Standard', safe: 'Colour-blind friendly' },
    paletteHelp:
      'Colour-blind friendly: on the map, heavier infection is brighter (dark → orange → pale yellow), and the warning and calm colours become vermilion and sky blue, so nothing depends on telling red from green.',
  },

  about: {
    title: 'About and credits',
    intro: [
      'Bewilderment is a strategy game about how infectious diseases spread and how they are stopped, and a personal project for learning how to build a game engine. It is open source (MIT) and not for commercial release.',
      'It is not an epidemiological model, and certainly not medical advice: pathogen numbers are game values set after the “character” of their models, not real parameters; air and sea routes are estimated from population, economy and distance, not real flight or shipping data. To learn about real diseases, see the pages of the World Health Organization and national disease-control agencies listed below.',
      'Borders on the map come from public geographic data and are there only to give the game a playable world map; they imply no position on any boundary or status.',
    ],
    sections: {
      data: 'Data',
      references: 'References',
      runtime: 'Open-source software (running in your browser)',
      tools: 'Open-source software (build, test, deploy)',
    },
    sources: 'Sources for the disease facts',
    sourcesNote:
      'The facts about diseases in the encyclopedia come from these public pages and were checked against the originals before going into the game.',
    ownWork: 'Made for this project',
    ownWorkText:
      'The rules, numbers, interface, map rendering and the text of the five chapters were written for this project; all sound is synthesised at run time with no recorded samples; fonts are the ones on your system.',
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

  chapters: {
    title: 'Chapters',
    number: (n) => `Chapter ${n}`,
    passedAttacker: 'Pathogen ✓',
    passedDefender: 'Response ✓',
    task: 'Your task',
    attackerGoal: 'Do all of this before the deadline:',
    defenderGoal: 'Hold to the deadline; do not let the opponent do this:',
    deadline: (days) => `within ${days} days`,
    lessons: 'What this chapter teaches',
    start: 'Start this chapter',
    standard:
      'Decided by the calamity line: the pathogen wins when total deaths reach it; eradicating it or holding to the end wins for the response.',
    goals: {
      infected: (target) => `${target} people infected in total`,
      regions: (target) => `Infection in ${target} regions`,
      wealthy: (target) => `Infection in ${target} high-income regions`,
      traits: (target) => `${target} traits acquired`,
      deaths: (target) => `${target} deaths in total`,
    },
    daysLeft: (days) => `${days} days left`,
    reportedNote: 'Progress here is counted from reports; the true numbers are never lower.',
    unknown: 'Unknown',
    passed: (name) => `Chapter “${name}” passed.`,
    failed: (name) => `Chapter “${name}” not passed.`,
    next: 'Next chapter',
    again: 'Play this chapter again',
  },

  hints: {
    title: 'Guide',
    dismiss: 'Got it',
    items: {
      goal: "This panel on the left is the chapter's goal: what to do, how far along it is, and how many days are left.",
      time: 'Time is at the bottom: pause, 1×, 3×, 10×. Nothing happens while time is paused; your decisions take effect the next day.',
      map: 'Drag to pan and scroll to zoom; click a region to see its details on the right. Brighter means more infection.',
      latency:
        'People in the incubation period are not yet ill and the other side cannot see them; even the ill are only partly reported. The response moves once reported cases pile up.',
      spread:
        'It reached a new region: the arc lighting up on the map is the path it just took. Land routes only reach neighbours.',
      countered:
        'The response has started taking measures (the small icons on regions). Measures cut transmission there and cost the other side budget.',
      firstReport:
        'A region has reported cases. Click it and turn on “More testing” and “Isolate cases” on the right: the earlier and the more you find, the more isolation helps. Reports are the tip of the iceberg.',
      budget:
        'The budget is running dry. Every measure has a daily upkeep and works less well when you cannot pay: turn off the least useful, or wait for income.',
      points:
        'You have enough mutation points for a trait: open “Evolve” on the right. Routes spread it further, symptoms make it harsher (and easier to notice), abilities make it harder to deal with.',
      tradeoff:
        'Each trait makes the next cost more. Harsher symptoms are noticed sooner: spread first, or hit harder first?',
      research:
        'Open “Plan research” on the right. Do “Identify the pathogen” first: only then can you see what it is and which traits it has taken.',
      identified:
        'Identification is done: the “Pathogen” panel on the right now shows what it is and every mutation.',
      terrain:
        'Regions differ: click one to see its climate, density and wealth. Dense places spread droplets fast; wealthy places have strong care and early detection.',
      borders:
        'It is walking along land routes. See where it goes next and close that land border **before** it arrives; that is cheaper than sealing it afterwards.',
      trust:
        'Public trust is falling. Long lockdowns wear it down, and so do deaths; with low trust every measure works less well.',
      defended:
        'Wealthy regions have strong care and fast detection, and act at the first sign. Stealth delays detection; resistance abilities let it withstand what they use.',
      economy:
        'Lockdowns, grounded flights and closed ports all cut the budget a region pays in. Economic loss shows in the final tally: defences have a price.',
      routes:
        'Flights and shipping are open in this chapter: infection jumps across oceans along them. Select a region to see where it connects; grounding flights and closing ports cut those links.',
      vaccine:
        'The pathogen is identified, so vaccine work can begin: three steps, and the sooner the better. Once it rolls out, the susceptible become immune in batches.',
      calamity:
        'The calamity line is past thirty percent. When total deaths reach it, the pathogen wins.',
    },
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
