/* Task 1: Unveiling the Coordinates */
const coordinates = { x: 34, y: 42, z: 67 };

let { x, y } = coordinates;
console.log(x, y);

/* Task 2: The Map of Secrets */
const locations = {
  first: "Cave of Wonders",
  second: "Lake of Mystery",
  third: "Mount of Ages",
  fourth: "Desert of Shadows",
};

let { first, second, ...remaining } = locations;
console.log(first, second);

/* Task 3: The Mysterious Door */
const doorCode = {
  upper: "Alpha",
  lower: "Omega",
};

let { upper, lower, middle = "Desert of Shadows" } = doorCode;
console.log(upper, lower, middle);

/* Task 4: The Guardian's Riddle */
const riddle = {
  ancientWord: "Sphinx",
  modernWord: "Cat",
};

let { ancientWord: translation } = riddle;
console.log(riddle);

/* Task 5: The Array of Elements */
const elements = ["Fire", "Water", "Earth", "Air"];

const [initial, next] = elements;
console.log(initial, next);

/* Task 6: Skipping Stones */
const stones = [1, 2, 3, 4, 5, 6];

const [beginning, , , , , last] = stones;
console.log(beginning, last);

/* Task 7: The Array of Shadows */
const shadows = ["Darkness", "Silence", "Whisper", "Echo"];

const [darkness, ...others] = shadows;
console.log(darkness);

/* Task 8: The Wise Function */
function revealPath({ direction, distance }) {
  console.log(`You need to travel ${direction}, which is ${distance} away.`);
}

/* Task 9: The Scroll of Defaults */
function mixPotion(ingredient1 = "Water", ingredient2 = "Fireflower") {
  console.log(
    `Mixing ${ingredient1} with ${ingredient2} to create a powerful potion.`
  );
}

/* Task 10: The Array Spell */
function castSpell([firstIngredient, secondIngredient]) {
  console.log(`Casting spell with ${firstIngredient} and ${secondIngredient}.`);
}

/* Task 11: The Nested Secret */
const nestedSecret = { outer: { inner: "The Final Key" } };

const {
  outer: { inner },
} = nestedSecret;
console.log(inner);

/* Task 12: The Swap of Fate */
let stoneA = "Emerald";
let stoneB = "Ruby";

[stoneA, stoneB] = [stoneB, stoneA];
console.log(stoneA, stoneB);
