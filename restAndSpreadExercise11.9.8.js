/* Task 1: Track Animal Sightings */
function animalSightings(...animals) {
  for (i = 0; i < animals.length; i++) {
    console.log(animals[i]);
  }
}
function trackAnimal() {}
/* Task 2: Merge Habitat Areas */
const forestHabitats = ["Forest A", "Forest B"];
const savannahHabitats = ["Savannah C", "Savannah D"];
const protectedAreaNames = [...forestHabitats, ...savannahHabitats];

/* Task 3: Update Conservation Status */
const rhinoStatus = {
  population: 500,
  status: "Endangered",
};

const newRhinoStatus = {
  ...rhinoStatus,
  population: 600,
  Environment: "African Plains",
};

/* Task 4: Catalog Genetic Diversity */
const lionProfile = {
  name: "Leo",
  age: 5,
  species: "Lion",
};

const newLionProfile = { ...lionProfile, genetics: "pure" };

// Observations:
// Making a copy this way creates a new object that you can manipulate independently of the original. So
// making any changes to nested properties has no effect on the other object.

/* Task 5: Analyze Ecosystem Health */
const ecosystemHealth = {
  waterQuality: "Good",
  foodSupply: {
    herbivores: "Abundant",
    carnivores: "Sufficient",
  },
};

const updatedEcosystemHealth = { ...ecosystemHealth };
updatedEcosystemHealth.foodSupply.herbivores = "Scarce";

// Observations:
// Whenever you make a copy of something that has nested elements, they reference the same nested elements.
// So while the copied object or array is technically not the same as the original, whenever you change
// a nested element of either, the other changes as well.
