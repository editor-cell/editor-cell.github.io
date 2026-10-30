/**
 * Section names shared by the site, RSS feeds and downloadable readings.
 *
 * 30 Oct 2026: one word each, as the parts of an atlas are named: Earth (climate, water,
 * land and air), Society (economy, politics and public life), Science, Health and Culture.
 * The addresses (climate-environment, economy-politics, …) stay as they were, so every
 * link and saved reading keeps working.
 */
/** @type {Record<import("./types.ts").Lang, Record<import("./types.ts").Theme, string>>} */
export const sectionCopy = {
  "en": {
    "climate-environment": "Earth",
    "economy-politics": "Society",
    "science-technology": "Science",
    "health": "Health",
    "culture": "Culture"
  },
  "tr": {
    "climate-environment": "Yeryüzü",
    "economy-politics": "Toplum",
    "science-technology": "Bilim",
    "health": "Sağlık",
    "culture": "Kültür"
  },
  "ar": {
    "climate-environment": "الأرض",
    "economy-politics": "المجتمع",
    "science-technology": "العلوم",
    "health": "الصحة",
    "culture": "الثقافة"
  },
  "fr": {
    "climate-environment": "Terre",
    "economy-politics": "Société",
    "science-technology": "Sciences",
    "health": "Santé",
    "culture": "Culture"
  },
  "es": {
    "climate-environment": "Tierra",
    "economy-politics": "Sociedad",
    "science-technology": "Ciencia",
    "health": "Salud",
    "culture": "Cultura"
  }
};
