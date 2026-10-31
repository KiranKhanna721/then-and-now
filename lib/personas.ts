import type { Profile } from "./types";

// Fictional demo people. Each one exercises a different part of the agent:
// Rosa (bilingual, moderate stage, regional taste), Harold (a specific song to
// avoid by an artist he still loves), Mei (immigrant across two cultures).
export const PERSONAS: Profile[] = [
  {
    id: "demo-rosa",
    demo: true,
    name: "Rosa",
    birthYear: 1948,
    gender: "female",
    hometown: "East Los Angeles, California",
    laterPlaces: "Pico Rivera, California (1970-2015)",
    currentCity: "Whittier, California",
    languages: "Spanish, English",
    loves:
      "Vicente Fernández and Javier Solís records on Sunday mornings. Watched I Love Lucy and telenovelas with her mother. Menudo and pan dulce from the neighborhood panadería. Dancing cumbias at family weddings. Later in life, Selena.",
    avoid: "Vietnam War (her brother served)\nhospitals",
    stage: "moderate",
    notes: "Worked 30 years as a seamstress. Proud of her garden: roses and tomatoes. Calls everyone 'mija'.",
  },
  {
    id: "demo-harold",
    demo: true,
    name: "Harold",
    birthYear: 1941,
    gender: "male",
    hometown: "Detroit, Michigan",
    laterPlaces: "Southfield, Michigan (1972-2010)",
    currentCity: "Ann Arbor, Michigan",
    languages: "English",
    loves:
      "Motown: the Temptations, Marvin Gaye, Smokey Robinson. Tigers baseball on the radio. Coney Island hot dogs. Westerns like Gunsmoke and Bonanza. Saturday nights at jazz clubs on the east side.",
    avoid: "the 1967 Detroit riots\nhis late wife Dorothy's favorite song 'My Girl' makes him cry",
    stage: "mild",
    notes: "Worked on the line at Ford's River Rouge plant for 31 years. Loves to tell stories and be asked for his opinion.",
  },
  {
    id: "demo-mei",
    demo: true,
    name: "Mei",
    birthYear: 1952,
    gender: "female",
    hometown: "Taipei, Taiwan",
    laterPlaces: "San Francisco, California (moved 1975, Sunset District)",
    currentCity: "Daly City, California",
    languages: "Mandarin, Taiwanese Hokkien, English",
    loves:
      "Teresa Teng songs. Romance films from the 1970s. Beef noodle soup and night-market snacks. The Sound of Music. Ran a bakery in the Sunset District for 25 years. Mahjong with friends on Fridays.",
    avoid: "medical dramas",
    stage: "mild",
    notes: "Soft-spoken; opens up when talking about baking. Daughter is named Lily.",
  },
];
