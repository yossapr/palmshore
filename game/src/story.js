// The story of Palmshore: who says what, the five jobs, their stages, rewards and the weapons
// they unlock. Data only; missions.js runs it.

import { PLACES } from './world.js';

export const CHARACTERS = {
  DEE: { name: 'DEE MARLOW', color: '#f2c14e' },
  IVY: { name: 'IVY MARLOW', color: '#6fc0b8' },
  SONNY: { name: 'UNCLE SONNY', color: '#e0a06a' },
  DORSEY: { name: 'DORSEY VANE', color: '#d9776a' },
  BRASSLINE: { name: 'BRASSLINE', color: '#c9b6d8' },
  RADIO: { name: 'RADIO', color: '#b9ab90' },
};

const line = (speaker, text) => ({ speaker, text });

export const MISSIONS = [
  {
    id: 'first-tide',
    number: 1,
    title: 'First Tide',
    giver: 'IVY',
    start: { x: PLACES.diner.x, y: PLACES.diner.y },
    startLabel: 'Meet Ivy at the Sunray Diner',
    blurb: 'A car, a curb, and a favour for family.',
    intro: [
      line('IVY', "Dee. You look like you slept in that car. Don't answer, it's rhetorical."),
      line('DEE', "I slept under it, actually. Better shade."),
      line('IVY', "There's a Brisa sitting in the Coral Sands lot. Red, soft top, borrowed from a man who won't miss it for an hour."),
      line('IVY', 'Bring it to Marina 7. Try not to redecorate Ocean Drive on the way.'),
    ],
    stages: [
      { kind: 'goto', at: PLACES.beachLot, radius: 70, label: 'Get to the Coral Sands lot', hint: 'Follow the gold marker east to the beach.' },
      {
        kind: 'steal', at: { x: 3982, y: 1214 }, radius: 80, label: 'Steal the red Brisa',
        spawnCar: { type: 'sports', x: 3982, y: 1214, angle: 0, color: '#e8563f', label: 'Brisa' },
      },
      { kind: 'drive', at: PLACES.marina, radius: 110, label: 'Deliver the Brisa to Marina 7' },
    ],
    reward: 400,
    outro: [
      line('IVY', "Clean. The man downstairs is going to be furious, and I'm going to be rich. Same thing, really."),
      line('IVY', "Stick around, Dee. This city pays people who can drive."),
    ],
  },
  {
    id: 'pawn-toll',
    number: 2,
    title: 'Pawn Toll',
    giver: 'SONNY',
    start: { x: PLACES.pawn.x, y: PLACES.pawn.y },
    startLabel: "See Uncle Sonny at the pawn shop",
    blurb: 'A debt, a park bench, and three men who want it back.',
    intro: [
      line('SONNY', "Dee! My favourite niece-shaped person. You still owe me for that alternator."),
      line('DEE', 'You gave me the alternator. It was in a bucket.'),
      line('SONNY', "The Gulls owe me eight hundred and they've stopped answering the phone. The envelope's with their runner in Palmshore Park."),
      line('SONNY', "Take it. If Dorsey's boys turn up, my advice is: be elsewhere. Or be armed."),
    ],
    stages: [
      { kind: 'goto', at: PLACES.park, radius: 80, label: 'Collect the envelope in Palmshore Park' },
      {
        kind: 'kill', label: 'Deal with the Gulls', radius: 0,
        spawn: [
          { x: 2160, y: 1930, weapon: 'pistol', health: 80 },
          { x: 1950, y: 2110, weapon: 'pistol', health: 80 },
          { x: 2090, y: 2205, weapon: 'shotgun', health: 95 },
        ],
        taunt: line('DORSEY', "Sonny's money, Sonny's problem. Nobody walks out of my park with my envelope."),
      },
      { kind: 'goto', at: PLACES.pawn, radius: 70, label: 'Take the money back to Sonny' },
    ],
    reward: 650,
    unlocks: { weapon: 'shotgun', ammo: 24 },
    outro: [
      line('SONNY', "You're alive. That's more than the last runner. Here's your cut, and a little something for the glovebox."),
      line('SONNY', "That's a shotgun, Dee. It's for close conversations."),
    ],
  },
  {
    id: 'sunset-shakedown',
    number: 3,
    title: 'Sunset Shakedown',
    giver: 'IVY',
    start: { x: PLACES.strip[0].x, y: PLACES.strip[0].y },
    startLabel: 'Meet Ivy on the Coral Strip',
    blurb: 'Three shops, three envelopes, and a phone call Ivy should not have made.',
    intro: [
      line('IVY', 'The strip pays for its own protection. Usually to me. This month I want it collected by someone with a face strangers trust.'),
      line('DEE', "That's me? I look like a parking ticket."),
      line('IVY', 'Exactly. Three shops: surf, cream, postcards. Ask nicely. Take the envelope either way.'),
      line('IVY', "And Dee — if the third one calls the police, don't stand around explaining. I've seen your explanations."),
    ],
    stages: [
      {
        kind: 'collect', label: 'Collect the strip envelopes', radius: 58,
        points: PLACES.strip, hint: 'Three gold blips on the Coral Strip.',
      },
      { kind: 'escape', label: 'Shake the heat', hint: 'Break line of sight and stay gone.', heat: 92 },
      { kind: 'goto', at: PLACES.marina, radius: 100, label: 'Drop the takings at Marina 7' },
    ],
    reward: 1000,
    unlocks: { weapon: 'smg', ammo: 60 },
    outro: [
      line('IVY', "The strip is quiet. The cops are embarrassed. Dorsey Vane sent me a fruit basket, which is his way of saying he's watching."),
      line('IVY', "You've got a reputation now, Dee. I got you something to protect it."),
    ],
  },
  {
    id: 'crane-game',
    number: 4,
    title: 'Crane Game',
    giver: 'IVY',
    start: { x: PLACES.docks.x, y: PLACES.docks.y },
    startLabel: 'Meet Ivy at the Gannet Docks',
    blurb: 'The Gulls have a manifest. Ivy wants it before the ink dries.',
    intro: [
      line('IVY', "The Gulls are moving something heavy through my marina tonight, and the paperwork says it isn't theirs."),
      line('DEE', "You want me to steal a piece of paper. From a dock full of men with a crane and a grudge."),
      line('IVY', "I want you to steal the flatbed it's sitting on. The paper comes free. Dorsey's boys will notice, so keep the engine running."),
      line('IVY', 'Bring it to Marina 7. If the truck starts smoking, that is normal. If it starts burning, that is also normal, but less ideal.'),
    ],
    stages: [
      {
        kind: 'steal', at: { x: 1380, y: 2406 }, radius: 100, label: 'Steal the flatbed on Gannet Road',
        spawnCar: { type: 'pickup', x: 1380, y: 2406, angle: 0, color: '#b46a4a', label: 'Gull Flatbed' },
      },
      { kind: 'drive', at: PLACES.marina, radius: 120, label: 'Drive the manifest to Marina 7' },
      {
        kind: 'kill', label: 'Fight off the Gulls at the marina', radius: 0,
        spawn: [
          { x: 3940, y: 2870, weapon: 'pistol', health: 90 },
          { x: 3902, y: 2720, weapon: 'smg', health: 95 },
          { x: 4010, y: 2920, weapon: 'shotgun', health: 105 },
        ],
        taunt: line('DORSEY', "You took my truck, Dee. So I'm taking the marina. Fair trade, by dock rules."),
      },
      { kind: 'goto', at: PLACES.marina, radius: 100, label: 'Report to Ivy at Marina 7' },
    ],
    reward: 1600,
    outro: [
      line('IVY', 'This manifest is a smoking gun with a shipping number. Verano Land Holdings paid the Gulls to move something that was never on a manifest.'),
      line('IVY', 'There is one name on every page. Brassline. He is having a party at the tower tonight. We are going to ruin it.'),
    ],
  },
  {
    id: 'high-tide',
    number: 5,
    title: 'High Tide',
    giver: 'IVY',
    start: { x: 2750, y: 1690 },
    startLabel: 'Meet Ivy below Verano Tower',
    blurb: 'The last party. The last favour. The last tide.',
    intro: [
      line('IVY', "Brassline built half this city with Gulls money and called it sunshine. Tonight he's celebrating the other half."),
      line('DEE', "And we're not invited."),
      line('IVY', "We're the entertainment. Those are his enforcers by the fountain — Dorsey's best, wearing better suits."),
      line('IVY', 'Brassline is the one in the pale jacket. Finish it, Dee. Then get out before the whole department comes down on you.'),
    ],
    stages: [
      {
        kind: 'kill', label: 'Take out Brassline and his crew', radius: 0,
        spawn: [
          { x: 2690, y: 1580, weapon: 'pistol', health: 100 },
          { x: 2820, y: 1580, weapon: 'smg', health: 110 },
          { x: 2640, y: 1730, weapon: 'shotgun', health: 110 },
          { x: 2860, y: 1730, weapon: 'pistol', health: 100 },
          { x: 2750, y: 1510, weapon: 'smg', health: 240, boss: true, name: 'BRASSLINE' },
        ],
        taunt: line('BRASSLINE', "You're the Marlow kid. Your sister has a talent for sending people to do her feelings."),
      },
      { kind: 'escape', label: 'Leave Palmshore before dawn', heat: 160, hint: 'Lose the police, then get clear.' },
      { kind: 'goto', at: PLACES.marina, radius: 120, label: 'Get to the boat at Marina 7' },
    ],
    reward: 4000,
    end: true,
    outro: [
      line('IVY', 'The manifest went to three newspapers and a very nervous accountant. Verano Land is finished by lunch.'),
      line('DEE', "And us?"),
      line('IVY', "We're just getting started. There's a whole coast out there, Dee. And I hear the weather's lovely."),
    ],
  },
];

export const END_CARD = {
  title: 'THE TIDE TURNS',
  lines: [
    'Brassline is gone. The Gulls are scattered. Verano Land is a footnote.',
    'Palmshore belongs to the people who were already here.',
  ],
  credit: 'DEE MARLOW  ·  IVY MARLOW  ·  PALMSHORE',
};

export const RADIO_LINES = [
  'PALMSHORE BAY — 31°, water warm, skies unbothered.',
  'Traffic on Palmshore Boulevard is a rumour, not a road.',
  'The city is raising your rent and lowering your standards.',
  'Marina 7: live music, cold beer, no questions.',
  'Another beautiful day on the Gulf of Somewhere Else.',
];
