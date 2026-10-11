/**
 * Festival day data for the home page "Durga Puja Days & Timings" switch.
 *
 * PROVENANCE — read before editing:
 *  - Maha Shashthi's entry is taken verbatim from the scraped mirror
 *    (mirror/home.html), so it is source-of-truth content.
 *  - The Maha Ashtami Sandhi Puja window (08:54 PM - 09:42 PM, Monday
 *    19 October 2026) is quoted verbatim from mirror/panzika.html.
 *  - The remaining ritual names and clock times were WRITTEN to match the
 *    shape of the existing Shashthi panel. They follow standard Bengali
 *    Durga Puja practice but are not scraped from the original site, and
 *    should be treated as editorial copy pending review.
 */

export type FestivalDay = {
  key: string;
  /** Short label shown on the vertical tab, e.g. "Oct 16". */
  tabDate: string;
  /** Tithi name, e.g. "Shukla Shashthi". */
  tithi: string;
  /** Long form date, e.g. "16th October, Friday". */
  date: string;
  title: string;
  bengali: string;
  description: string;
  timings: { label: string; time: string }[];
};

export const FESTIVAL_DAYS: FestivalDay[] = [
  {
    key: "shashthi",
    tabDate: "Oct 16",
    tithi: "Shukla Shashthi",
    date: "16th October, Friday",
    title: "Maha Shashthi",
    bengali: "মহাষষ্ঠী · বোধন ও অধিবাস",
    description:
      "The start of Durga Puja. Maa Durga is welcomed and awakened with evening Bodhon under the Bel tree, the rhythm of dhak, and first pandal visits across the city.",
    timings: [
      { label: "Kalparambha", time: "Morning · 06:15 AM" },
      { label: "Bodhon & Amantran", time: "Evening · 05:45 PM" },
      { label: "Adhibas", time: "Evening · 07:15 PM" },
    ],
  },
  {
    key: "saptami",
    tabDate: "Oct 17–18",
    tithi: "Shukla Saptami",
    date: "17th – 18th October, Saturday – Sunday",
    title: "Maha Saptami",
    bengali: "মহাসপ্তমী · সাজা ও কাঞ্জাক নগর",
    description:
      "The second day, and the first full one. Fresh garlands and a fresh pandal face each morning, while the Kanjak Nagar procession carries the city's anticipation from door to door.",
    timings: [
      { label: "Subah Brahmacharjan", time: "Morning · 06:30 AM" },
      { label: "Kanjak Nagar Dhaki", time: "Morning · 08:00 AM" },
      { label: "Sandhya Puja", time: "Evening · 06:15 PM" },
      { label: "Arati & Dhak Naad", time: "Evening · 07:30 PM" },
    ],
  },
  {
    key: "ashtami",
    tabDate: "Oct 19",
    tithi: "Shukla Ashtami",
    date: "19th October, Monday",
    title: "Maha Ashtami",
    bengali: "মহাষ্টমী · সন্ধ্যাপুজা ও মহিষাসুরবধ",
    description:
      "The peak. Mahishasura is slain at the exact moment the sun and moon share a longitude, and Maa Lakshmi is welcomed into her own home as the household's Mother.",
    timings: [
      { label: "Morning Puja", time: "Morning · 07:00 AM" },
      { label: "Kankali Bibah", time: "Afternoon · 04:00 PM" },
      { label: "Sandhi Puja", time: "Evening · 08:54 PM" },
      { label: "Ashtami Veshar", time: "Evening · 09:42 PM" },
    ],
  },
  {
    key: "nabami",
    tabDate: "Oct 20",
    tithi: "Shukla Nabami",
    date: "20th October, Tuesday",
    title: "Maha Nabami",
    bengali: "মহানবমী · খঞ্জন ও বিজয়ার আগে",
    description:
      "The long calm before Bijoya. Maa Durga is bathed and dressed as Mahalakshmi for the final evening of worship, and the pandals begin to grow quiet.",
    timings: [
      { label: "Nabami Shatthi", time: "Morning · 06:45 AM" },
      { label: "Mahalakshmi Besharam", time: "Evening · 05:30 PM" },
      { label: "Sandhya Puja", time: "Evening · 06:45 PM" },
      { label: "Last Dhak & Aarti", time: "Evening · 08:00 PM" },
    ],
  },
  {
    key: "dashami",
    tabDate: "Oct 21",
    tithi: "Shukla Dashami",
    date: "21st October, Wednesday",
    title: "Vijaya Dashami",
    bengali: "বিজয়া দশমী · বিসর্জন ও বিদায়",
    description:
      "Maa returns to her mountain home. Visarjan follows the final arati, and the gates of Mahishasura's lair close for another year.",
    timings: [
      { label: "Dhami Muhurat", time: "Morning · 06:15 AM" },
      { label: "Final Arati & Offerings", time: "Afternoon · 05:45 PM" },
      { label: "Visarjan", time: "Evening · 07:00 PM" },
      { label: "Bijoya & Farewell", time: "Evening · 08:30 PM" },
    ],
  },
];

export const DAYS_BY_KEY: Record<string, FestivalDay> = Object.fromEntries(
  FESTIVAL_DAYS.map((d) => [d.key, d])
);