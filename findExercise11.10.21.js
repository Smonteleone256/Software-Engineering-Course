const mythicalCreatures = [
  { name: "Dragon", type: "Fire", lastSeen: "Volcano Valley" },
  { name: "Mermaid", type: "Water", lastSeen: "Coral Caves" },
  { name: "Unicorn", type: "Land", lastSeen: "Enchanted Forest" },
  { name: "Griffin", type: "Air", lastSeen: "Highwind Mountains" },
  { name: "Kraken", type: "Water", lastSeen: "Abyssal Depths" },
];

mythicalCreatures.find(function (creature) {
  return creature.type === "Water";
});
mythicalCreatures.findIndex(function (creature) {
  return creature.name === "Griffin";
});
mythicalCreatures.find(function (creature) {
  return creature.lastSeen === "Enchanted Forest";
});
