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

  outcomes: {
    calamity: 'Deaths crossed the calamity line.',
    eradicated: 'The pathogen was eradicated.',
    timeout: 'The line held to the end.',
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
