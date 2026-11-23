// Palmshore's story: five jobs, the people who hand them out and what they say. Pure data —
// the mission engine in missions.js reads it, the HUD prints it, and none of it draws.

export const CHARACTERS = {
  rook: { name: 'ROOK', color: '#ee9a7c' },
  ray: { name: 'RAY', color: '#f0c96a' },
  marisol: { name: 'MARISOL', color: '#8fd2c4' },
  dunne: { name: 'DUNNE', color: '#b8c8d8' },
  vargas: { name: 'VARGAS', color: '#dd6b52' },
  lila: { name: 'LILA', color: '#f0d8a8' },
};

export const STORY = {
  title: 'PALMSHORE',
  tagline: 'Three days. One city. Everybody wants a piece of the sun.',
  intro: [
    'Ray Calderón came home for his brother’s funeral and found the deed to the Sunray Hotel missing.',
    'Rook has it. Everybody in this town owes somebody, and the tide is coming in.',
  ],
  missions: [
    {
      id: 'sunbleached',
      title: 'SUNBLEACHED',
      contact: 'ROOK',
      startSpot: 'safehouse',
      blurb: 'Steal a car, collect the Sunray deed, bring it home.',
      reward: 450,
      unlock: 'pistol',
      unlockLabel: 'PISTOL · 12 ROUNDS',
      intro: [
        ['ROOK', 'Ray. Sorry about Teo. Truly. The Sunray was his, and now the paperwork says it is mine.'],
        ['RAY', 'Paperwork burns, Rook.'],
        ['ROOK', 'Not this one. It is in a lockbox at Tide Line storage. Bring me a car with clean plates and it is yours.'],
      ],
      steps: [
        { type: 'goto', spot: 'sunray', label: 'Meet Rook at the Sunray', radius: 42, say: [['ROOK', 'The Sunray. Twelve floors of bad decisions and one very good pool.']] },
        { type: 'steal', label: 'Steal a car for the drop', radius: 40, say: [['ROOK', 'Anything with four wheels. Try not to bleed on the upholstery.']] },
        { type: 'goto', spot: 'storage', label: 'Drive the car to Tide Line storage', radius: 52, needCar: true, say: [['ROOK', 'Tide Line. South docks. Keep the engine running.']] },
        { type: 'kill', spot: 'storage', enemies: 2, label: 'Deal with Vargas’ boys', radius: 70, say: [['ROOK', 'Those are Vargas’ collectors. They were not invited.']] },
        { type: 'collect', spot: 'storage', offset: { x: 40, y: 10 }, label: 'Take the deed from the lockbox', radius: 38, say: [['RAY', 'Deed, ledger, and a photograph of Teo. Rook has been busy.']] },
        { type: 'goto', spot: 'safehouse', label: 'Bring the deed home to Casa Luna', radius: 44, needCar: true, say: [['ROOK', 'Casa Luna. I will meet you there. Do not open the ledger.']] },
      ],
      outro: [
        ['ROOK', 'The deed is yours. The ledger stays with me.'],
        ['RAY', 'Teo kept books on everybody in this town. That is why he is dead.'],
      ],
    },
    {
      id: 'tideline',
      title: 'TIDE LINE',
      contact: 'ROOK',
      startSpot: 'storage',
      blurb: 'Vargas’ collectors want the ledger back. Take their cash instead.',
      reward: 850,
      unlock: 'shotgun',
      unlockLabel: 'SHOTGUN · 6 SHELLS',
      intro: [
        ['ROOK', 'Vargas sent collectors to Pier 9. They are holding a cash box and asking about Teo.'],
        ['RAY', 'And you want me to answer them.'],
        ['ROOK', 'I want you to take the box. The answering is your business.'],
      ],
      steps: [
        { type: 'goto', spot: 'pier9', label: 'Meet the collectors at Pier 9', radius: 54, say: [['ROOK', 'Pier 9. Smell that? Money and diesel.']] },
        { type: 'kill', spot: 'pier9', enemies: 3, label: 'Take the cash from Vargas’ collectors', radius: 80, say: [['VARGAS', 'You are Teo’s brother. You have his stubborn face.']] },
        { type: 'collect', spot: 'pier9', offset: { x: 20, y: 52 }, label: 'Pick up the cash box', radius: 38, say: [['RAY', 'Twelve thousand. Vargas is not paying his people enough to die for him.']] },
        { type: 'escape', label: 'Lose the cops', heat: 2, say: [['ROOK', 'You fired a gun in a city with three hundred cops and nothing else to do. Move.']] },
      ],
      outro: [
        ['ROOK', 'Twelve thousand. The Sunray’s roof needs it.'],
        ['RAY', 'Marisol Vane has the ledger. She was Teo’s courier. She knew him better than I did.'],
      ],
    },
    {
      id: 'coralarms',
      title: 'CORAL ARMS',
      contact: 'MARISOL',
      startSpot: 'coralArms',
      blurb: 'Marisol is running the ledger to Vargas. Run her off the road.',
      reward: 1400,
      unlock: 'smg',
      unlockLabel: 'SMG · 30 ROUNDS',
      intro: [
        ['MARISOL', 'Ray. You look like your brother when he was angry.'],
        ['RAY', 'You have Teo’s ledger.'],
        ['MARISOL', 'I have half of Palmshore’s secrets in a briefcase. Vargas gets the other half at sundown. Catch me.'],
      ],
      steps: [
        { type: 'goto', spot: 'coralArms', label: 'Find Marisol at the Coral Arms', radius: 46, say: [['MARISOL', 'Room 12. The one with the broken air conditioner.']] },
        { type: 'chase', spot: 'coralArms', carType: 'coupe', label: 'Run Marisol’s car off the road', radius: 70, say: [['MARISOL', 'You are going to have to do better than that, Calderón!']] },
        { type: 'collect', spot: 'coralArms', offset: { x: -60, y: 80 }, label: 'Take the briefcase', radius: 38, say: [['MARISOL', 'Take it. It will not save you from Vargas.']] },
        { type: 'goto', spot: 'safehouse', label: 'Drive the briefcase to Casa Luna', radius: 44, needCar: true, say: [['ROOK', 'Bring it home. The whole coast is going to want it.']] },
      ],
      outro: [
        ['ROOK', 'The ledger says Vargas bought the Sunray out from under Teo. And the Nautilus vault holds his payments.'],
        ['RAY', 'Then we take the Nautilus.'],
      ],
    },
    {
      id: 'nautilus',
      title: 'NAUTILUS',
      contact: 'DUNNE',
      startSpot: 'nautilus',
      blurb: 'Lift Vargas’ vault from the Nautilus tower and outrun three stars.',
      reward: 2800,
      unlock: 'armour',
      unlockLabel: 'BODY ARMOUR · FULL PLATE',
      intro: [
        ['DUNNE', 'Vargas keeps his payments in the Nautilus basement. I keep the keycard.'],
        ['RAY', 'Why help me?'],
        ['DUNNE', 'Because he stopped paying me. Money is the only honest language in this town.'],
      ],
      steps: [
        { type: 'goto', spot: 'nautilus', label: 'Meet Dunne in the Nautilus lobby', radius: 46, say: [['DUNNE', 'Elevator is locked. The guards are not. Here is the keycard.']] },
        { type: 'kill', spot: 'nautilus', enemies: 5, label: 'Clear the Nautilus lobby', radius: 90, say: [['DUNNE', 'Five of them. Try to keep the marble clean.']] },
        { type: 'collect', spot: 'nautilus', offset: { x: -38, y: 30 }, label: 'Open Vargas’ vault', radius: 38, say: [['RAY', 'Four hundred thousand. Enough to buy the Sunray twice.']] },
        { type: 'escape', spot: 'marina', heat: 3, label: 'Lose the heat and reach the marina', radius: 48, say: [['DUNNE', 'The alarm is on. Vargas will burn this city down before he lets you keep that money.']] },
      ],
      outro: [
        ['ROOK', 'Four hundred thousand and a city full of cops. You have outdone yourself.'],
        ['RAY', 'Vargas took Lila. He wants the money and the ledger at the pier at sundown.'],
      ],
    },
    {
      id: 'lastlight',
      title: 'LAST LIGHT',
      contact: 'LILA',
      startSpot: 'pier9',
      blurb: 'Vargas has your sister. End this at the pier.',
      reward: 6000,
      unlock: 'palmshore',
      unlockLabel: 'THE SUNRAY HOTEL · DEED RESTORED',
      intro: [
        ['VARGAS', 'Ray Calderón. Your brother drowned owing me a hundred thousand dollars.'],
        ['RAY', 'My brother drowned because you put him in the water.'],
        ['VARGAS', 'The pier. Sundown. Bring the ledger, or bring your sister’s ear.'],
      ],
      steps: [
        { type: 'goto', spot: 'pier9', label: 'Vargas is waiting at Pier 9', radius: 56, say: [['LILA', 'Ray — he has a dozen men. Please do not be brave.']] },
        { type: 'survive', time: 30, label: 'Survive Vargas’ crew', radius: 90, say: [['VARGAS', 'Kill him. Then bring me the briefcase.']] },
        { type: 'kill', spot: 'pier9', enemies: 2, boss: true, offset: { x: 46, y: -20 }, label: 'Put Vargas down', radius: 90, say: [['VARGAS', 'You and I are the same kind of animal, Calderón.']] },
        { type: 'escape', spot: 'marina', heat: 4, label: 'Reach the marina and disappear', radius: 52, say: [['LILA', 'The boat is fueled. The keys are under the seat. Do not look back.']] },
      ],
      outro: [
        ['ROOK', 'They will write about this. Not the way it happened, but they will write.'],
        ['RAY', 'Let them write. The Sunray stays in the family.'],
        ['LILA', 'And the city?'],
        ['RAY', 'The city can keep the sun. I am keeping the hotel.'],
      ],
    },
  ],
  activity: {
    title: 'COURIER RUN',
    blurb: 'Three packages across Palmshore before the timer runs dry.',
    perDrop: 180,
    bonus: 320,
    seconds: 120,
  },
};
