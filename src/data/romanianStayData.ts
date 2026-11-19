import { LatLngLiteral } from '../types';

export interface StayOfficeLocation {
  id: string;
  name: string;
  role: string;
  address: string;
  metro: string;
  hours: string;
  phone?: string;
  emergencyPhone?: string;
  website?: string;
  coords: LatLngLiteral;
}

export const ROMANIAN_EMBASSY: StayOfficeLocation = {
  id: 'embassy-ro',
  name: 'Embassy of Romania in Lisbon',
  role: 'Consular Services & Romanian Citizens Support',
  address: 'Rua de São Caetano à Lapa 5, 1200-828 Lisboa',
  metro: 'Rato (Yellow) or Santos train · Bus 713 / 727',
  hours: 'Mon–Fri consular appointments via econsulat.ro',
  phone: '+351 21 396 6463',
  emergencyPhone: '+351 927 411 628',
  website: 'https://lisabona.mae.ro/',
  coords: { lat: 38.7113, lng: -9.1636 },
};

export const KEY_STUDENT_OFFICES: StayOfficeLocation[] = [
  {
    id: 'financas-laranjeiras',
    name: 'Loja de Cidadão Laranjeiras (Finanças)',
    role: 'Free NIF (Tax Number) Counter',
    address: 'Rua Abranches Ferrão 10, 1600-001 Lisboa',
    metro: 'Laranjeiras (Blue Line) · 5 min walk',
    hours: 'Mon–Fri 08:30–19:30 (arrive early or book via SigaApp)',
    website: 'https://www.portaldasfinancas.gov.pt/',
    coords: { lat: 38.7482, lng: -9.1725 },
  },
  {
    id: 'loja-lisboa-entrecampos',
    name: 'Loja Lisboa Entrecampos (Câmara Municipal)',
    role: 'CRUE EU Citizen Registration (>90 days)',
    address: 'Campo Grande 25, 1749-099 Lisboa',
    metro: 'Entrecampos (Yellow Line) · 4 min from ISCTE',
    hours: 'Mon–Fri 08:30–19:30 · Book appointment via siga.marcacaodeatendimento.pt',
    website: 'https://www.lisboa.pt/',
    coords: { lat: 38.7495, lng: -9.1489 },
  },
  {
    id: 'navegante-campo-grande',
    name: 'Espaço Navegante Campo Grande',
    role: 'Free Sub23 / Student Transit Pass',
    address: 'Estação de Metro Campo Grande, Lisboa',
    metro: 'Campo Grande (Yellow & Green) · 1 stop from ISCTE',
    hours: 'Mon–Fri 08:00–19:00 · Bring ID, NIF, photo & ISCTE proof',
    website: 'https://www.navegante.pt/',
    coords: { lat: 38.7601, lng: -9.1578 },
  },
  {
    id: 'hospital-santa-maria',
    name: 'Hospital de Santa Maria (Public SNS)',
    role: 'Major Public Hospital & Emergency (CEASS / EHIC accepted)',
    address: 'Av. Prof. Egas Moniz, 1649-035 Lisboa',
    metro: 'Cidade Universitária (Yellow) · 10 min walk from ISCTE',
    hours: '24/7 Urgências · Call SNS 24 (808 24 24 24) first for non-emergencies',
    phone: '808 24 24 24',
    coords: { lat: 38.7484, lng: -9.1604 },
  },
];

export const LISBON_AIRPORT_COORDS: LatLngLiteral = {
  lat: 38.7742,
  lng: -9.1342,
};

export const ROMANIAN_EU_QUICK_FACTS = [
  {
    label: 'Visa & Entry',
    value: 'No Visa Needed (EU)',
    note: 'Romanian Carte de Identitate (CI) or Passport is valid for flights and stay. Carry both if possible.',
  },
  {
    label: 'Health Coverage',
    value: 'CEASS / EHIC in SNS',
    note: 'Order your free Romanian CEASS card from CNAS 3–4 weeks before leaving. Valid at Portuguese public clinics & hospitals.',
  },
  {
    label: 'Time Difference',
    value: 'Lisbon = RO − 2 hours',
    note: 'Portugal (WET/WEST) is always 2 hours behind Bucharest (EET/EEST). Same EU daylight saving switch dates.',
  },
  {
    label: 'Power Plugs',
    value: 'Same as Romania (230V)',
    note: 'Portugal uses the exact same Type F Schuko sockets as Romania — zero plug adapters needed.',
  },
];

export const ROMANIAN_DOCS_DEEP_DIVE = [
  {
    id: 'ro-id',
    title: 'Romanian Carte de Identitate (CI) vs. Passport',
    badge: 'Before Departure',
    summary:
      'As a Romanian EU citizen, your valid Romanian CI is legally sufficient to fly Bucharest → Lisbon, rent a flat, open a NIF, register CRUE, and study at ISCTE.',
    bullets: [
      'Your Romanian CI prints your home address on the back — Finanças officers commonly accept it directly as proof of EU address for your NIF.',
      'Bring your Romanian Passport too as a backup ID (and store encrypted scans of CI, Passport, CEASS, and ISCTE Carta de Aceitação in iPhone Files).',
      'Check expiry dates: make sure your CI/Passport stays valid past your semester end date.',
    ],
  },
  {
    id: 'ceass-sns',
    title: 'CEASS / EHIC & Public Healthcare (SNS)',
    badge: 'Before Departure',
    summary:
      'Apply free for the Cardul European de Asigurări Sociale de Sănătate (CEASS) from your county CNAS in Romania before leaving (students are insured free).',
    bullets: [
      'In Portugal, CEASS entitles you to medically necessary care in the public SNS (Centros de Saúde & public hospitals like Hospital de Santa Maria, 10 min from ISCTE) on the same terms as residents.',
      'For any non-life-threatening illness, call SNS 24 at 808 24 24 24 (press the English menu) — a nurse triages you and tells you which Centro de Saúde to visit so you skip long ER waits.',
      'CEASS does NOT cover private clinics (CUF / Luz) or medical repatriation to Romania — consider cheap Erasmus/Revolut travel insurance for extra peace of mind.',
    ],
  },
  {
    id: 'nif-ro',
    title: 'Portuguese Tax Number (NIF)',
    badge: 'Week 1 · Free',
    summary:
      'Your 9-digit NIF (Número de Identificação Fiscal) unlocks registered rental contracts, Navegante Sub23, Portuguese SIMs, and GIRA bike passes.',
    bullets: [
      'Go free in person to Finanças at Loja de Cidadão Laranjeiras (Blue Line) or Saldanha — EU citizens do NOT need a Portuguese fiscal representative.',
      'Bring: Romanian CI (or Passport + Romanian bank statement showing your Romanian home address).',
      'Book an appointment via SigaApp or arrive right at 08:15 before doors open to grab a same-day ticket.',
    ],
  },
  {
    id: 'crue-ro',
    title: 'CRUE — EU Residence Registration (> 90 Days)',
    badge: 'Days 30–120 · €15',
    summary:
      'EU citizens staying in Portugal longer than 3 months must request the Certificado de Registo de Cidadão da União Europeia (CRUE) at Câmara Municipal de Lisboa.',
    bullets: [
      'Closest office to ISCTE: Loja Lisboa Entrecampos (Campo Grande 25, 4 min walk from campus!).',
      'Bring: Romanian CI/Passport, ISCTE Certificado de Matrícula, physical CEASS/EHIC card, €15 fee, and signed declaration of sufficient funds (provided at desk).',
      'Bonus perk: With your CRUE / Lisbon residency, you unlock 52 free days/year (Sundays & holidays) at Portuguese national museums & monuments and free GIRA bike membership!',
    ],
  },
  {
    id: 'sub23-ro',
    title: 'Navegante Sub23 — Free Unlimited Lisbon Transit',
    badge: 'Week 1 · €0 / month',
    summary:
      'Students aged 23 and under (and up to age 24 for Architecture Integrated Master’s students) ride ALL Lisbon Metro, Carris buses/trams, Sintra & Cascais trains, Fertagus, and ferries for €0/month.',
    bullets: [
      'Download your ISCTE enrollment proof (Certificado de Matrícula / Sub23 form) from Fénix right after check-in.',
      'Bring Romanian ID/Passport, NIF, ISCTE proof, and 1 passport photo to Espaço Navegante at Campo Grande (1 metro stop from ISCTE).',
      'Card printing costs €7 (10 business days) or €12 urgent (24h). Use a €0.50 Viva Viagem + Zapping until it arrives.',
    ],
  },
];

export const MONEY_CARDS_GUIDE = [
  {
    title: 'RON → EUR Conversion Strategy',
    tag: 'Save 3–5% on every purchase',
    detail:
      'Use Revolut, Wise, Salt Bank, or a Romanian bank EUR account (BCR George / ING / Raiffeisen) linked to Apple Pay. Exchange RON to EUR on weekdays (Mon–Fri) to avoid Revolut’s 1% weekend FX fee.',
    rule: 'Golden ATM & POS Rule: Whenever a terminal asks "Charge in RON or EUR?", ALWAYS pick EUR (Without Conversion).',
  },
  {
    title: 'Blue Multibanco (MB) vs. Yellow Euronet ATMs',
    tag: 'Zero-fee cash withdrawals',
    detail:
      'Official Portuguese bank ATMs display the blue "MB / Multibanco" logo and charge €0 local operator surcharge on EU cards. Yellow/blue "Euronet" ATMs in tourist streets charge €4–€5 fees plus terrible RON conversion markups — avoid them completely.',
    rule: 'Carry €15–€20 cash: supermarkets & cafes accept Apple Pay, but traditional tascas and small kiosks often accept only local Multibanco cards or cash.',
  },
  {
    title: 'Do You Need a Portuguese Bank Account / MB Way?',
    tag: 'Usually optional for 1 semester',
    detail:
      'MB Way is Portugal’s instant phone-number transfer app (like Instant Pay in RO), but it requires a Portuguese bank account (ActivoBank is the most popular free option for Erasmus students with NIF + passport + ISCTE enrollment). For one semester, Revolut/Wise SEPA instant EUR transfers + cash usually suffice.',
    rule: 'SEPA EUR transfers from Revolut/Wise/Romanian EUR accounts to your Portuguese landlord’s PT50 IBAN are free and typically arrive same-day.',
  },
];

export const ROMANIA_FLIGHTS_INFO = {
  routes: [
    {
      airline: 'Wizz Air',
      route: 'Bucharest Otopeni (OTP) ↔ Lisbon (LIS)',
      duration: '~4h 25m direct',
      tip: 'Cheapest if booked 4–8 weeks ahead; check Wizz Discount Club if flying home mid-semester or with friends. Uses LIS Terminal 2 (free 5-min green shuttle bus to Terminal 1 Metro!).',
    },
    {
      airline: 'HiSky',
      route: 'Bucharest (OTP) / Cluj (CLJ) ↔ Lisbon (LIS)',
      duration: '~4h 20m direct',
      tip: 'Seasonal/regular direct flights with competitive checked-baggage bundles for your full semester suitcase.',
    },
    {
      airline: 'TAROM / Lufthansa / KLM',
      route: 'OTP / CLJ / TSR / IAS ↔ LIS (1-stop via FRA/MUC/AMS)',
      duration: '6h–8h with connection',
      tip: 'Good option from Cluj, Timișoara, or Iași when carrying a 23 kg suitcase + architecture tube/backpack.',
    },
  ],
  airportToIscte: [
    'If landing at Terminal 2 (low-cost/Wizz), hop on the free green ANA Shuttle Bus to Terminal 1 (runs every 10 min, 5 min ride).',
    'At Terminal 1, follow red "Metro" signs down to Estação Aeroporto (Red Line). Buy a €0.50 Viva Viagem card + €10 Zapping at the machine (€1.66 per ride).',
    'Ride Red Line 9 stops to Saldanha → change to Yellow Line northbound (Sentido Odivelas) → ride 2 stops to Entrecampos → 4 min flat walk to ISCTE (~32 min total).',
    'Arriving with 2 heavy suitcases? Bolt or Uber from LIS Terminal 1 P2 Kiss & Fly to Entrecampos costs only €7–€12 and takes 12 minutes!',
  ],
};

export const MONTHLY_BUDGET_ROWS = [
  {
    item: 'Shared flat room (Arroios / Alvalade / Entrecampos / Benfica)',
    eur: '€430 – €640',
    ron: '~2,150 – 3,200 RON',
    note: 'Book early; closer to Saldanha/Santos pushes toward €650–€730.',
  },
  {
    item: 'Utilities (water, electricity, gas, fiber Wi-Fi)',
    eur: '€45 – €80',
    ron: '~225 – 400 RON',
    note: 'Higher in Dec–Feb if using electric space heaters; verify if included.',
  },
  {
    item: 'Groceries (Lidl, Aldi, Pingo Doce & local markets)',
    eur: '€150 – €210',
    ron: '~750 – 1,050 RON',
    note: 'Very similar to Bucharest supermarket prices; produce & fish are great value.',
  },
  {
    item: 'ISCTE Cantina lunches, bicas & occasional tascas',
    eur: '€65 – €115',
    ron: '~325 – 575 RON',
    note: 'ISCTE Cantina social meal is ~€2.80–€4.50; espresso (bica) is €0.85.',
  },
  {
    item: 'Public transit (Navegante Sub23 ≤23 / Metropolitano 24+)',
    eur: '€0 (or €40)',
    ron: '0 – 200 RON',
    note: 'Sub23 covers Metro, buses, Sintra/Cascais trains, Caparica & Setúbal free!',
  },
  {
    item: 'Architecture studio plotting (A1/A0) & model supplies',
    eur: '€30 – €70',
    ron: '~150 – 350 RON',
    note: 'Spikes during mid-term & final crits (foamboard, laser cutting, color plots).',
  },
  {
    item: 'Mobile 5G SIM / eSIM (Digi PT / WOO / Yorn)',
    eur: '€5 – €12',
    ron: '~25 – 60 RON',
    note: 'Always pick "sem fidelização" (no 24-month lock-in).',
  },
];

export const HOUSING_PORTALS_LIST = [
  {
    name: 'Idealista.pt',
    type: 'Local direct listings · €0 platform fee',
    pros: 'Widest selection and lowest rents direct from Portuguese landlords.',
    watchOut: 'Rooms go within hours; message politely in Portuguese and NEVER wire money before a live video or in-person viewing.',
    url: 'https://www.idealista.pt/en/arrendar-quartos/lisboa/',
  },
  {
    name: 'SAS-ISCTE Student Residences',
    type: 'University housing · Budget friendly',
    pros: 'Cheapest option (~€250–€380) and instant student community.',
    watchOut: 'Very limited Erasmus spots — apply the exact day ISCTE IRO opens applications.',
    url: 'https://www.iscte-iul.pt/',
  },
  {
    name: 'Uniplaces / HousingAnywhere',
    type: 'Verified booking platforms · High one-time fee',
    pros: 'Escrow protects your first month’s rent until 24–48h after move-in; safe when booking remotely from Romania.',
    watchOut: 'One-time booking commission (€150–€350) and slightly higher monthly rents than Idealista.',
    url: 'https://www.uniplaces.com/',
  },
  {
    name: 'Quarto-a-Quarto & Erasmus Lisbon Groups',
    type: 'Peer-to-peer room shares',
    pros: 'Great for finding outgoing Erasmus roommates leaving rooms mid-year.',
    watchOut: 'High scam volume on Facebook — always request a live FaceTime/WhatsApp walkthrough showing the street sign and flat interior.',
    url: 'https://www.bquarto.pt/',
  },
];

export const DAILY_LISBON_SURVIVAL = [
  {
    title: 'Winter Indoor Cold & Humidity Shock (Nov–Mar)',
    tag: 'Biggest surprise for Romanians',
    detail:
      'Unlike Romanian apartments with central heating (termoficare/centrală), most historic Lisbon flats have NO central heating and high Atlantic humidity (75–90%). Even when it is 14°C outside, unheated tiled rooms feel chilly at night.',
    tip: 'Ask landlords about double-glazed windows (vidros duplos), south-facing sunlight, and whether a dehumidifier (desumidificador) or oil heater is provided. Open windows midday when sunny to prevent mold.',
  },
  {
    title: 'Romanian EU Roaming vs. Portuguese SIM / eSIM',
    tag: 'Stay connected',
    detail:
      'Your Romanian SIM (Digi RO, Orange, Vodafone) works immediately on landing via EU Roaming, but Romanian providers enforce a 4-month continuous roaming fair-use surcharge and cap GBs.',
    tip: 'Grab a no-contract ("sem fidelização") Portuguese eSIM/SIM: Digi PT (€4–€7/mo), WOO or Amigo (€8–€12/mo), or Vodafone Yorn / MEO Moche for under-25 perks.',
  },
  {
    title: 'Supermarkets & Street Markets (Mercados)',
    tag: 'Grocery budget',
    detail:
      'Cheapest staples: Lidl & Aldi (Sete Rios / Areeiro / Alvalade). Best ready-made hot meals & daily groceries: Pingo Doce (€5–€7 takeaway boxes). Biggest variety: Continente (Entrecampos / Colombo).',
    tip: 'Visit Mercado de Alvalade (15 min walk from ISCTE) or Mercado de Arroios in the morning for fresh seasonal fruit, vegetables, and bread at local prices.',
  },
  {
    title: 'Student Discounts & Free Culture Perks',
    tag: 'Show ISCTE Card / CRUE',
    detail:
      'With your ISCTE student card & CRUE residency: 52 free days/year (Sundays & holidays) at Portugal’s national museums and monuments (Jerónimos, Belém Tower, Azulejo Museum, Ajuda Palace); 50% off Gulbenkian & Cascais museums; 25% CP Jovem rail discount (<25); €20/mo CP Passe Ferroviário Verde for nationwide trains.',
    tip: 'Apply for GIRA Lisbon city bikes (€25/yr, or FREE with Lisbon residency + Navegante) — Entrecampos, Alvalade, and Avenidas Novas are completely flat with great bike lanes!',
  },
];

export const PT_TO_RO_GRADING_SCALE = [
  { pt: '18 – 20', ro: '10', ects: 'A', label: 'Excelente (Top distinction — rare in Portugal)' },
  { pt: '16 – 17', ro: '9', ects: 'B', label: 'Muito Bom (Strong Architecture studio mark)' },
  { pt: '14 – 15', ro: '8', ects: 'C', label: 'Bom (Solid above-average grade)' },
  { pt: '12 – 13', ro: '7', ects: 'D', label: 'Suficiente+ (Good pass)' },
  { pt: '10 – 11', ro: '6', ects: 'E', label: 'Suficiente (Minimum passing grade = 10/20)' },
  { pt: '0 – 9', ro: 'Fail (<5)', ects: 'F', label: 'Reprovado (Retake in Época de Recurso)' },
];

export const ISCTE_ARCH_ESSENTIALS = [
  {
    title: 'Architecture Studio Culture & Crits (Críticas)',
    detail:
      'ISCTE Architecture (ISTA) emphasizes physical spatial thinking alongside digital CAD/BIM. Expect weekly desk crits (acompanhamento), mid-semester pin-ups (entrega intermédia), and final jury critiques. Working study models (maquetas de trabalho) in grey board or foamboard are highly valued even for early concept reviews.',
  },
  {
    title: 'Model Workshops, Laser Cutting & Plotting',
    detail:
      'Book model-making workshop and laser-cutter slots at least 5–7 days before crit weeks — queues spike right before deadlines. For fast A1/A0 color plotting, bindery, and 2mm foamboard (cartão pluma), check the reprografia cluster around Entrecampos and Cidade Universitária (see Atlas → Print & Model).',
  },
  {
    title: 'Eduroam & Fénix Portal Setup',
    detail:
      'Configure Eduroam on your iPhone and laptop with your Romanian university account BEFORE leaving Romania — it logs in seamlessly across ISCTE buildings, ULisboa, and major Lisbon libraries. Use ISCTE’s Fénix portal for timetables, studio rooms (Edifício I, II, Sedas Nunes, Edifício 4), and downloading your Certificado de Matrícula.',
  },
  {
    title: 'Libraries & Study Spots Beyond Campus',
    detail:
      'ISCTE’s own library (Biblioteca) has strong architecture monographs and quiet study floors. When you want a change of scenery, ride 2 stops south on the Yellow Line to the Calouste Gulbenkian Art Library (Biblioteca de Arte) — an iconic modernist reading room surrounded by lush gardens, completely free to enter.',
  },
  {
    title: 'Subsidized Cantina & Campus Fuel',
    detail:
      'ISCTE’s social canteen (Cantina) serves a full lunch (soup, hot meat/fish/veg main, bread, fruit, water) for ~€2.80–€4.50 with student status. Campus bars serve €0.80 bicas (espresso) and €2–€3 tostas mistas for long studio afternoons.',
  },
  {
    title: 'What to Pack from Romania vs. Buy in Lisbon',
    detail:
      'Pack from Romania: laptop + charger (same Type F plug!), favorite scale ruler (escalímetro), mechanical pencils, sketchbook, USB stick for reprografias, and precision cutter blades (in checked luggage only!). Buy in Lisbon: bulky A1 drawing tubes, foamboard, cardboard, UHU glue, and cutting mats.',
  },
];
