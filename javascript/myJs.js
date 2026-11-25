const guests = {
    ANTONY: {
      title: "General",
      region: "Rome",
      dietaryPreference: "Vegetarian",
      pastGifts: ["Golden Laurel", "Chariot"]
    },
    CICERO: {
      title: "Orator",
      region: "Arpinum",
      dietaryPreference: "Omnivore",
      pastGifts: ["Scroll of Proverbs", "Quill"]
    }
  };

guests.BRUTUS = {
    title: "Senator",
    region: "Rome",
    dietaryPreference: "Vegan",
    pastGifts: ["Silver Dagger", "Marble Bust"]
};


guests.CICERO.pastGifts.push("Golden Lyre");


guests.ANTONY.region;


delete guests.CICERO;


const generalProfile = guests.ANTONY;


generalProfile.region = "Egypt"


//Question It will also be the newly assinged "Egypt" as both names reference the same data
