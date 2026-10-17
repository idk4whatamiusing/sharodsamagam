/**
 * Single source of truth for the five days of Devi Paksha 2026.
 *
 * PROVENANCE: every field here originates from the dataset that already
 * existed in app/panzika/page.tsx. That page was written first and is
 * treated as authoritative. An earlier version of this file contained
 * separately-invented ritual names and timings for the four non-Shashthi
 * days, which contradicted the panzika page - the same site answering the
 * same question two different ways. Do not reintroduce parallel copies:
 * edit here and both pages change together.
 */

export type Rite = readonly [label: string, time: string];

export type FestivalDay = {
  /** Stable slug used for the tab data attributes and lookup keys. */
  key: "shashthi" | "saptami" | "ashtami" | "nabami" | "dashami";
  /** English title, e.g. "Maha Shashthi". */
  name: string;
  /** Short date for the panzika header row, e.g. "16 Oct". */
  date: string;
  /** Full date for the home page panel, e.g. "16th October, Friday". */
  longDate: string;
  /** Compact label for the vertical tab, e.g. "Oct 16". */
  tabDate: string;
  /** Tithi badge, e.g. "Shukla Shashthi". */
  tithi: string;
  /** Bengali day name alone, e.g. "মহাষষ্ঠী". */
  bn: string;
  /** Bengali day name plus a short subtitle for the home panel. */
  bnFull: string;
  desc: string;
  bhog: string;
  /** The headline ritual, shown as "Key:" on the panzika page. */
  highlight: string;
  rites: readonly Rite[];
};

export const FESTIVAL_DAYS: readonly FestivalDay[] = [
  {
    key: "shashthi",
    name: "Maha Shashthi",
    date: "16 Oct",
    longDate: "16th October, Friday",
    tabDate: "Oct 16",
    tithi: "Shukla Shashthi",
    bn: "মহাষষ্ঠী",
    bnFull: "মহাষষ্ঠী · বোধন ও অধিবাস",
    desc:
      "বোধন ও অধিবাস — The start of Durga Puja. Maa Durga is welcomed and awakened with evening Bodhon.",
    bhog: "Luchi, Chholar Dal, Sandesh & Malpua",
    highlight: "Bel tolai Bodhon & Dhak beats",
    rites: [
      ["Kalparambha", "Morning · 06:15 AM"],
      ["Bodhon & Amantran", "Evening · 05:45 PM"],
      ["Adhibas", "Evening · 07:15 PM"],
    ],
  },
  {
    key: "saptami",
    name: "Maha Saptami",
    date: "17–18 Oct",
    longDate: "17th – 18th October, Saturday – Sunday",
    tabDate: "Oct 17–18",
    tithi: "Shukla Saptami",
    bn: "সপ্তমী",
    bnFull: "সপ্তমী · নবপত্রিকা স্নান ও প্রাণপ্রতিষ্ঠা",
    desc:
      "Navapatrika Snan — bathing of the Nabapatrika (Kola Bou) and Pran Pratistha.",
    bhog: "Khichuri, Labra, Begun Bhaja",
    highlight: "Navapatrika & Pran Pratistha",
    rites: [
      ["Navapatrika Snan", "Morning · 06:00 AM"],
      ["Pran Pratistha", "Morning · 08:30 AM"],
      ["Sandhi Aarati", "Evening · 06:00 PM"],
    ],
  },
  {
    key: "ashtami",
    name: "Maha Ashtami",
    date: "19 Oct",
    longDate: "19th October, Monday",
    tabDate: "Oct 19",
    tithi: "Shukla Ashtami",
    bn: "অষ্টমী",
    bnFull: "অষ্টমী · সন্ধ্যাপুজা ও মহিষাসুরবধ",
    desc:
      "Kumari Puja & the midnight Sandhi Puja junction rites with 108 lotuses and 108 diyas.",
    bhog: "Khichuri with Mishti Doi",
    highlight: "Sandhi Puja 08:54 – 09:42 PM",
    rites: [
      ["Kumari Puja", "Morning"],
      ["Pushpanjali", "Morning"],
      ["Sandhi Puja", "08:54 – 09:42 PM"],
      ["Dhunuchi Naach & Aarati", "Evening"],
    ],
  },
  {
    key: "nabami",
    name: "Maha Nabami",
    date: "20 Oct",
    longDate: "20th October, Tuesday",
    tabDate: "Oct 20",
    tithi: "Shukla Nabami",
    bn: "নবমী",
    bnFull: "নবমী · মহাঅঞ্জলি ও ধুনুচি নাচ",
    desc:
      "Anjali followed by grand Dhunuchi Naach — the evening of incense dance and aarati.",
    bhog: "Basanti Pulao, Kosha Mangsho",
    highlight: "Maha Anjali & Dhunuchi",
    rites: [
      ["Pushpanjali", "Morning"],
      ["Maha Anjali", "Evening · 05:30 PM"],
      ["Dhunuchi Naach", "Late Evening"],
    ],
  },
  {
    key: "dashami",
    name: "Vijaya Dashami",
    date: "21 Oct",
    longDate: "21st October, Wednesday",
    tabDate: "Oct 21",
    tithi: "Shukla Dashami",
    bn: "দশমী",
    bnFull: "দশমী · সিন্দুরখেলা ও বিদায়",
    desc:
      "Sindoor Khela — Bengali women smear each other with vermilion in a bittersweet farewell.",
    bhog: "Mishti Doi, Payesh, Sandesh",
    highlight: "Sindoor Khela & Biday",
    rites: [
      ["Sindoor Khela", "Morning · 09:00 AM"],
      ["Dhunuchi & Biday", "Afternoon"],
      ["Immersion Processions", "Evening onwards"],
    ],
  },
];

export const DAYS_BY_KEY = Object.fromEntries(
  FESTIVAL_DAYS.map((d) => [d.key, d])
) as Record<FestivalDay["key"], FestivalDay>;