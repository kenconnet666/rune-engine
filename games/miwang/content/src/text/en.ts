/** 英文文案：和 zh.ts 一一对应 */
import type { ContentText, Label } from './types.ts';

const label = (name: string, detail: string): Label => ({ name, detail });

export const en: ContentText = {
  climates: ['Tropical', 'Temperate', 'Cold'],
  wealth: ['Low income', 'Lower-middle income', 'Upper-middle income', 'High income'],
  density: ['Sparse', 'Moderate density', 'Dense'],
  groups: {
    route: 'Transmission',
    symptom: 'Symptoms',
    ability: 'Abilities',
  },

  traits: {
    air1: label(
      'Droplets',
      'Carried on droplets from coughing and talking. Thrives in crowds and cold weather.',
    ),
    air2: label('Airborne', 'Smaller particles linger in the air and travel well on flights.'),
    air3: label(
      'Aerosol',
      'Stays suspended indoors for hours: one person can infect a whole room.',
    ),
    contact1: label(
      'Contact',
      'Spreads through handshakes and shared objects. Dense regions suit it.',
    ),
    contact2: label(
      'Surface survival',
      'Survives longer on surfaces and rides along with sea cargo.',
    ),
    water1: label(
      'Waterborne',
      'Contaminates drinking water and food. Hits regions with poor sanitation first.',
    ),
    water2: label('Foodborne', 'Multiplies in food and travels further along trade and shipping.'),
    vector1: label(
      'Mosquito-borne',
      'Spread by mosquito bites. Year-round in the tropics, summer only elsewhere.',
    ),
    vector2: label(
      'Vector adaptation',
      'Adapts to more mosquito species; a single bite is enough.',
    ),
    blood1: label(
      'Bloodborne',
      'Spreads through blood and body fluids; the illness lasts longer. Lockdowns barely touch it.',
    ),
    blood2: label(
      'Mother-to-child and medical',
      'Spreads through unsafe medical procedures and from mother to child.',
    ),
    animal1: label(
      'Animal reservoir',
      'Persists in wildlife: cleared regions see cases flare up again.',
    ),
    animal2: label(
      'Livestock reservoir',
      'Moves into livestock, which people live alongside every day.',
    ),

    cough: label('Cough', 'Mild, but every cough helps it spread.'),
    sneeze: label('Sneezing', 'Droplets travel further.'),
    fever: label('Fever', 'The body fights back. Patients start to notice they are ill.'),
    pneumonia: label('Pneumonia', 'The infection reaches the lungs; patients need hospital care.'),
    respiratoryFailure: label('Respiratory failure', 'Fatal without breathing support.'),
    nausea: label('Nausea', 'A mild digestive symptom.'),
    diarrhea: label('Diarrhoea', 'Contaminates water sources and dehydrates the patient.'),
    dehydration: label('Severe dehydration', 'Without rehydration, patients die within days.'),
    rash: label('Rash', 'A visible symptom that also eases contact transmission.'),
    lesions: label('Skin lesions', 'Broken skin weeps infectious fluid.'),
    hemorrhage: label(
      'Haemorrhage',
      'Internal and external bleeding. Deadly, and shocking: hard to miss.',
    ),
    fatigue: label('Fatigue', 'Patients recover more slowly.'),
    immunosuppression: label(
      'Immunosuppression',
      'A weakened immune system: longer illness, more complications.',
    ),
    encephalitis: label('Encephalitis', 'Invades the central nervous system.'),
    organFailure: label('Multiple organ failure', 'The terminal stage.'),

    cold1: label('Cold tolerance', 'Can spread in cold regions.'),
    cold2: label('Polar adaptation', 'Cold no longer matters.'),
    heat1: label('Heat tolerance', 'Can spread in hot regions.'),
    heat2: label('Tropical adaptation', 'Heat no longer matters.'),
    resistance1: label(
      'Drug resistance',
      'Existing drugs work less well and medical care saves fewer patients.',
    ),
    resistance2: label('Multidrug resistance', 'Most drugs fail.'),
    drift1: label(
      'Antigenic drift',
      'Surface proteins keep changing: vaccines take longer and the recovered can be reinfected.',
    ),
    drift2: label('Antigenic shift', 'Changes faster still; immunity fades quickly.'),
    latency: label(
      'Longer incubation',
      'A longer incubation period carries it further before anyone knows.',
    ),
    presymptomatic: label('Presymptomatic spread', 'Infectious before symptoms appear.'),
    stealth1: label('Atypical symptoms', 'Easily mistaken for a minor illness; harder to detect.'),
    stealth2: label('Test evasion', 'Routine tests miss it.'),
    carrier: label(
      'Asymptomatic carriers',
      'Many infected people show no symptoms at all: milder, but nearly invisible.',
    ),
  },

  techs: {
    identify: label(
      'Pathogen identification',
      'Isolate and sequence the pathogen. Only then can you see its routes and every mutation.',
    ),
    rapidTest: label('Rapid tests', 'Cheap, fast test kits raise detection everywhere.'),
    tracing: label('Contact tracing', 'Trace close contacts so that isolation works better.'),
    origin: label(
      'Origin tracing',
      'Find the original source. Flare-ups from animal reservoirs become rarer.',
    ),
    treatment1: label(
      'Treatment protocol',
      'Work out effective supportive care; fewer patients die.',
    ),
    treatment2: label(
      'Targeted drug',
      'A specific drug cuts deaths further (resistance weakens it).',
    ),
    communication: label(
      'Risk communication',
      'Tell the public what is happening, promptly and openly. Raises the trust baseline.',
    ),
    aid: label(
      'International aid',
      'Medical and testing support lifts low-income regions to a middle level.',
    ),
    vaccine1: label('Vaccine candidates', 'Vaccine step one: design and screen candidates.'),
    vaccine2: label('Clinical trials', 'Vaccine step two: prove it is safe and effective.'),
    vaccine3: label(
      'Mass production',
      'Vaccine step three: once done, vaccination begins everywhere.',
    ),
    logistics: label(
      'Vaccination logistics',
      'Cold chain, sites and staff: vaccination speeds up.',
    ),
  },

  measures: {
    testing: label('More testing', 'Find more cases.'),
    isolation: label(
      'Isolate cases',
      'Isolate the patients you find; the more you find, the more it helps.',
    ),
    masks: label('Masks and distancing', 'Cuts droplet transmission. Costs a little trust.'),
    lockdown: label(
      'Lockdown',
      'Sharply cuts transmission and travel. Costly for the economy and for trust.',
    ),
    borders: label('Close land borders', 'Cuts land travel with neighbours.'),
    airports: label('Ground flights', 'Cuts air routes.'),
    ports: label('Close ports', 'Cuts sea routes.'),
    sanitation: label('Clean water', 'Cuts water and food transmission.'),
    vectorControl: label('Mosquito control', 'Cuts mosquito-borne transmission.'),
    screening: label('Entry screening', 'Stops some of the infected arrivals.'),
  },

  events: {
    festival: label('Festival', 'Crowds gather; transmission here rises for a while.'),
    sports: label('Sporting event', 'Packed stands; transmission here rises for a while.'),
    flood: label('Flood', 'Water is contaminated; care and testing are crippled for a while.'),
    earthquake: label(
      'Earthquake',
      'Hospitals are damaged; care and testing are crippled for a while.',
    ),
    rumor: label('Rumours spread', 'Public trust falls.'),
    breakthrough: label('Research breakthrough', 'Research in progress jumps ahead.'),
    funding: label('Emergency funding', 'The budget grows.'),
    mutation: label('Spontaneous mutation', 'The pathogen gains extra mutation points.'),
  },

  skills: {
    spillover: label(
      'Spillover',
      'Gain a foothold in a region it has not reached: a small cluster of infections appears there, connected or not.',
    ),
    surge: label('Surge', 'Make a region it has already reached spread faster for two weeks.'),
    dormancy: label(
      'Dormancy',
      'Harder to detect for a month, at the price of spreading a little slower. With fewer reports, attention drifts elsewhere.',
    ),
  },

  tasks: {
    reach: label('New ground', 'Reach a few more regions before the deadline.'),
    multiply: label('Multiply', 'Multiply total infections before the deadline.'),
    affluent: label(
      'Through the front door',
      'Enter a high-income region before the deadline: strong care, quick detection.',
    ),
    adapt: label('Adapt', 'Acquire a few more traits before the deadline.'),
    toll: label('Heavier toll', 'Double total deaths before the deadline.'),
    labwork: label('Lab push', 'Complete one more research project before the deadline.'),
    holdline: label(
      'Hold the line',
      'Until the deadline, no more than this many new regions may report cases.',
    ),
    steady: label(
      'Keep the public',
      'Until the deadline, public trust must never drop below the line.',
    ),
    flatten: label(
      'Flatten the curve',
      'At the deadline, reported active cases must be 30% lower than when the task began.',
    ),
  },

  decisions: {
    aidOffer: {
      name: 'Aid with strings attached',
      detail:
        'International aid can arrive at once, but the donors want their people on site and a say in decisions.',
      options: { decline: 'Decline', accept: 'Accept' },
    },
    dataRelease: {
      name: 'Release all the data?',
      detail:
        'Media and researchers want the full regional figures. Full disclosure earns trust; markets will panic for a while.',
      options: { summary: 'Summaries only', full: 'Release everything' },
    },
    trialReaction: {
      name: 'Adverse reactions in a trial',
      detail: 'A study has seen a few adverse reactions, and the cause is not yet clear.',
      options: { proceed: 'Carry on', pause: 'Pause and review' },
    },
    overtime: {
      name: 'Labs around the clock',
      detail: 'The research teams propose overtime and extra equipment to push current work ahead.',
      options: { steady: 'Stay on plan', push: 'Fund the overtime' },
    },
    holiday: {
      name: 'A long holiday is coming',
      detail:
        'A travel peak is days away. Letting it go ahead keeps people happy and lifts transmission for a while; discouraging travel does the opposite.',
      options: { allow: 'Let it go ahead', cancel: 'Discourage travel' },
    },
    testKits: {
      name: 'A faulty batch of tests',
      detail:
        'Spot checks show a batch of test kits in use misses too many cases. A recall costs money and leaves a short gap.',
      options: { keep: 'Keep using them', recall: 'Recall and replace' },
    },
    bottleneck: {
      name: 'A transmission bottleneck',
      detail:
        'In a small cluster, a lineage that spreads better has surfaced. Letting it take over costs some of what has been built up.',
      options: { bank: 'Let it be', adapt: 'Back this lineage' },
    },
    reservoir: {
      name: 'A foothold in animals',
      detail: 'It has established itself in a common animal.',
      options: { harvest: 'Mutate more', hide: 'Hide there' },
    },
    superspreader: {
      name: 'A superspreading event',
      detail:
        'At one gathering, one person infected dozens. Riding the wave spreads fast and draws attention.',
      options: { quiet: 'Stay quiet', seize: 'Ride the wave' },
    },
    variant: {
      name: 'New variants',
      detail:
        'Two variants are competing: one mild and easy to overlook, one fiercer and frightening.',
      options: { mild: 'The mild one', fierce: 'The fierce one' },
    },
  },

  pathogens: {
    novel: {
      name: 'Novel pathogen',
      kind: 'Unknown',
      summary:
        'A pathogen nobody has seen before: no model, nothing remarkable, and its future is yours to shape.',
      facts: ['It does not correspond to any real disease.'],
      play: 'Middling in every respect. A good first game.',
    },
    influenza: {
      name: 'Influenza type',
      kind: 'Virus · modelled on seasonal influenza',
      summary:
        'Spreads through coughs and sneezes, strikes quickly, and wears a new face every year.',
      facts: [
        'From infection to illness takes about 2 days, ranging from 1 to 4.',
        'In temperate climates epidemics come mainly in winter; in the tropics it can occur all year, less regularly.',
        'There are around a billion cases of seasonal influenza each year, 3 to 5 million of them severe.',
        'Immunity from vaccination fades over time, so annual vaccination is recommended.',
      ],
      play: 'Fast onset and fast change: abilities are cheap and it starts with antigenic drift, so vaccines struggle to keep up. It is mild; deaths have to come from sheer numbers.',
    },
    measles: {
      name: 'Measles type',
      kind: 'Virus · modelled on measles',
      summary:
        'One of the most contagious diseases known: a room a patient has left still carries the virus for two hours.',
      facts: [
        'The virus stays active and contagious in the air or on surfaces for up to two hours.',
        'Symptoms usually begin 7 to 14 days after exposure; a patient is infectious from four days before the rash to four days after.',
        'One person with measles can infect up to 18 others.',
        'Before the vaccine arrived in 1963, measles epidemics caused an estimated 2.6 million deaths a year.',
      ],
      play: 'Spreads extremely fast, and before the rash appears. But its transmission is already near the ceiling, so more is expensive, and a vaccine is hard to come back from: race the clock.',
    },
    cholera: {
      name: 'Cholera type',
      kind: 'Bacterium · modelled on cholera',
      summary:
        'Travels in contaminated water and food. Untreated it can kill within hours, yet the cure is remarkably simple.',
      facts: [
        'Symptoms appear 12 hours to 5 days after infection.',
        'Most infected people have no symptoms, but shed the bacteria in their faeces for 1 to 10 days.',
        'Cholera is a severe diarrhoeal disease that can be fatal within hours if untreated.',
        'Most patients can be treated with oral rehydration solution; the fatality rate in treatment centres should stay below 1%.',
      ],
      play: 'Sweeps through regions with poor sanitation and stalls in wealthy ones. Highly lethal, until the other side brings care and clean water.',
    },
    dengue: {
      name: 'Dengue type',
      kind: 'Virus · modelled on dengue',
      summary:
        'Spread by Aedes mosquito bites, a disease of tropical and subtropical cities. Most of the infected never know.',
      facts: [
        'If symptoms occur, they usually begin 4 to 10 days after infection and last 2 to 7 days.',
        'Most people have mild or no symptoms and get better in one to two weeks.',
        'People who are not yet showing symptoms, or never will, can still infect the mosquitoes that bite them.',
        'There is no specific treatment; care focuses on managing pain.',
      ],
      play: 'At home in the tropics, summer-only in temperate regions, nearly helpless in the cold. Stealthy, but vulnerable to mosquito control. To leave the tropics it must first learn to tolerate cold.',
    },
    malaria: {
      name: 'Malaria type',
      kind: 'Parasite · modelled on malaria',
      summary:
        'A parasitic disease carried by Anopheles mosquitoes; it does not pass directly between people.',
      facts: [
        'It spreads mainly through the bites of infected female Anopheles mosquitoes and not from person to person; blood transfusion and contaminated needles may also transmit it.',
        'Symptoms usually start within 10 to 15 days of the bite.',
        'Untreated P. falciparum malaria can progress to severe illness and death within 24 hours.',
        "In 2024 the WHO African Region had 95% of the world's malaria cases and 95% of malaria deaths.",
      ],
      play: 'A long incubation, a long illness and a little drug resistance. Tied to mosquitoes and the tropics like the dengue type, but deadlier.',
    },
    tuberculosis: {
      name: 'Tuberculosis type',
      kind: 'Bacterium · modelled on tuberculosis',
      summary:
        'A slow disease: it spreads slowly, lasts long, and most of the infected never fall ill.',
      facts: [
        'It spreads through the air when people with TB cough, sneeze or spit.',
        'About 5 to 10% of people infected with TB will eventually develop symptoms and TB disease.',
        'People who are infected but not ill generally feel well and are not contagious.',
        'Treatment means daily medication for 4 to 6 months.',
        'Worldwide, TB is the leading cause of death from a single infectious agent.',
      ],
      play: 'The slowest of all: incubation and illness are measured in months, it is hard to detect, and it starts with drug resistance. Games run long; patience beats speed.',
    },
    norovirus: {
      name: 'Norovirus type',
      kind: 'Virus · modelled on norovirus infection',
      summary:
        'A stomach bug that arrives fast and leaves fast, spread by contact, food and contaminated surfaces.',
      facts: [
        'Symptoms usually develop 12 to 48 hours after exposure, and most people get better within 1 to 3 days.',
        'You can still spread it for two weeks or more after you feel better.',
        'There are many different types of norovirus, so you can catch it many times in your life.',
        'There is no specific medicine for it; antibiotics do not work against viruses.',
      ],
      play: 'Ill within a day and spreading at speed, but almost never fatal. The recovered can catch it again. To win you must turn a nuisance into a killer.',
    },
    ebola: {
      name: 'Ebola type',
      kind: 'Virus · modelled on Ebola disease',
      summary:
        'Spread by contact with the blood and body fluids of the sick or the dead. Extremely lethal; fruit bats are thought to be its natural hosts.',
      facts: [
        'The average case fatality rate of Ebola disease is around 50%, and has varied from 25% to 90% in past outbreaks.',
        'The incubation period is 2 to 21 days; people cannot spread the disease before they have symptoms.',
        'Burial ceremonies with direct contact with the body can also contribute to transmission.',
        'Transmission through semen has been documented up to fifteen months after clinical recovery.',
      ],
      play: 'Extremely lethal and extremely visible from the first day: patients do not travel far and the other side sees you at once. To win it must learn to get out, or to hide.',
    },
    pertussis: {
      name: 'Pertussis type',
      kind: 'Bacterium · modelled on whooping cough',
      summary:
        'A respiratory bacterial disease that passes only between people, with a cough that will not go away.',
      facts: [
        'Symptoms usually develop within 5 to 10 days after exposure, sometimes as late as 21 days.',
        'It usually passes from person to person through respiratory droplets.',
        'It is a human disease: no animal or insect source is known.',
        'Some observational studies suggest that infection gives immunity for 4 to 20 years, but not for life.',
      ],
      play: 'Spreads faster than the influenza type, lasts long, and its atypical symptoms make it hard to spot. A solid all-rounder: any path works.',
    },
  },

  outcomes: {
    calamity: 'Deaths crossed the calamity line.',
    eradicated: 'The pathogen was eradicated.',
    timeout: 'The line held to the end.',
    goal: 'The pathogen did what this chapter asked of it.',
    held: "The chapter's deadline passed and the pathogen fell short.",
  },

  chapters: {
    bewilderment: {
      name: 'Bewilderment',
      line: 'A bewilderment too slight to fill a hand',
      theme: 'Origin',
      intro:
        'Everything starts small: a handful of cases in one region, too few to fill a hand. Nobody knows what it is; it is not yet anything itself.',
      attacker: 'Let it take root: get enough people infected before it is stopped.',
      defender: 'Find it and press it down while it is small: hold out to the deadline.',
      lessons: [
        'Reading the map: brighter means more infection; click a region for details',
        'Time: pause and fast-forward; commands take effect the next day',
        'Latency and detection: the response sees only reported cases, the tip of the iceberg',
      ],
    },
    malice: {
      name: 'Malice',
      line: 'From it an evil thought is born',
      theme: 'Mutation',
      intro:
        'It begins to change. Every transmission is a roll of the dice, and the rolls add up to a direction: better at spreading, harsher, harder to deal with.',
      attacker:
        'Gather mutation points and take traits: make it something else, while more and more people are infected.',
      defender:
        'Work out what you are facing: identify the pathogen, watch each mutation, and do not let it grow.',
      lessons: [
        'Mutation points come from infections and deaths; spend them on traits',
        'Three kinds of trait: routes, symptoms, abilities; each one makes the next cost more',
        "Research for the response: the opponent's traits are visible only after identification",
      ],
    },
    wilds: {
      name: 'The wilds',
      line: 'It crawls across the wilds',
      theme: 'Overland spread',
      intro:
        'Without wings, it walks. From one region to the next, across border after border; in this chapter there are no flights and no ships.',
      attacker: 'Walk out region by region: get infections into enough regions.',
      defender:
        'Set the barriers ahead of it: borders, isolation, measures in each region; keep it where it can walk.',
      lessons: [
        'Climate, density and wealth decide how well a region spreads it',
        'Land routes only reach neighbours: see where it goes next',
        'Regional measures each have a cost; close a border before it arrives',
      ],
    },
    hills: {
      name: 'The hills',
      line: 'It climbs over the hills',
      theme: 'Past the defences',
      intro:
        'Some places are hard to enter: many hospitals, fast testing, quick to lock down. It rises where defences are thin, and the highest hills are the ones to cross.',
      attacker: 'Break into wealthy regions: get infections into enough high-income regions.',
      defender:
        'Hold the strongest ground, and remember strong defences cost: lockdowns hurt the economy and, in time, trust.',
      lessons: [
        'Wealthy regions have strong care and fast detection; they are the hardest to enter',
        'Stealth and resistance abilities are for getting past defences',
        'The cost of lockdowns and grounding flights: less income, falling trust, and low trust weakens measures',
      ],
    },
    sky: {
      name: 'The sky',
      line: 'And sows calamity across the sky',
      theme: 'The global endgame',
      intro:
        'Flights and shipping are open and the world is connected. This is a full game: no extra conditions, and the outcome returns to the calamity line.',
      attacker: 'Let it fly: when deaths cross the calamity line, the game is yours.',
      defender: 'Race against time: eradicate it, or get the vaccine out before the calamity line.',
      lessons: [
        'Flights and shipping carry it across oceans; grounding flights and closing ports cut them',
        'A vaccine takes three research steps; once it rolls out, the susceptible become immune',
        'The calamity line: the pathogen wins when deaths reach it; eradication or holding to the end wins for the response',
      ],
    },
  },

  credits: {
    naturalEarth:
      'Borders, population, GDP and income groups of countries and regions (v5.1.2, 1:110m).',
    worldAtlas: "Natural Earth's borders packaged as TopoJSON; the map's shapes come from it.",
    isoCountries: 'Chinese names of countries and regions.',
    okabeIto:
      'The orange, vermilion and sky blue of the colour-blind friendly palette come from this set designed for colour-vision deficiency.',
    vue: 'The UI runtime.',
    vueTsxPro:
      'TSX compiler and style engine; component conventions and basic feel also follow its component library.',
    lucide: 'Icons in the interface (a few more were drawn for this project).',
    decimal: 'Exact decimal numbers, supported natively by the engine core.',
    internationalizedDate:
      'Calendar dates that ignore the system time zone: the “which day” of a game.',
    topojson: 'Extracts region polygons and adjacency when building the map.',
    earcut: 'Triangulates polygons when building the map.',
    typescript: 'The language this project is written in.',
    vite: 'Dev server and bundling.',
    vitest: 'Tests.',
    oxlint: 'Linting.',
    prettier: 'Code formatting.',
    wrangler: 'Emulates Cloudflare locally and deploys the server.',
  },

  effects: {
    air: 'Droplet and airborne spread',
    contact: 'Contact spread',
    water: 'Water and food spread',
    vector: 'Mosquito-borne spread',
    blood: 'Blood and fluid spread',
    animal: 'Animal reservoir',
    severity: 'Severity',
    lethality: 'Lethality',
    stealth: 'Stealth',
    cold: 'Cold tolerance',
    heat: 'Heat tolerance',
    resistance: 'Drug resistance',
    drift: 'Antigenic drift',
    presymptomatic: 'Presymptomatic spread',
    incubation: 'Incubation period',
    duration: 'Duration of illness',
    aviation: 'Spread along air routes',
    maritime: 'Spread along sea routes',
  },

  defense: {
    detection: 'Detection everywhere',
    isolation: 'Effect of isolation',
    treatment: 'Fewer deaths among patients',
    trust: 'Trust baseline',
    aid: 'Care and testing in low-income regions',
    identify: "Reveals the pathogen's traits",
    trace: 'Reveals the origin; fewer animal flare-ups',
    vaccine: 'Vaccine progress',
    rollout: 'Vaccination speed',
  },
};
