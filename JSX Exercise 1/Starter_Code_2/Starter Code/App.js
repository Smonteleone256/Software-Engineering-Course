function App() {
  const spacePhenomena = [
    { id: 1, name: "Asteroid Belt", emoji: "☄️" },
    { id: 2, name: "Galactic Nebula", emoji: "🌌" },
    { id: 3, name: "Black Hole", emoji: "🕳️" },
    { id: 4, name: "Supernova Explosion", emoji: "💥" },
    { id: 5, name: "Pulsar", emoji: "⚡" },
    { id: 6, name: "Quasar", emoji: "💫" },
    { id: 7, name: "Exoplanet", emoji: "🪐" },
    { id: 8, name: "Interstellar Cloud", emoji: "☁️" },
    { id: 9, name: "Gamma-Ray Burst", emoji: "🌠" },
    { id: 10, name: "Magnetic Field Reversal", emoji: "🧲" },
  ];

  const observationStatuses = ["🔭 Visible", "🌫 Faint", "🚀 Prime for Study"];

  function randomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
  }

  const phenomenaListItem = spacePhenomena.map(
    (phenomenon) =>
      phenomenon.emoji +
      phenomenon.name +
      observationStatuses[randomInt(0, observationStatuses.length - 1)],
  );

  return (
    <div>
      {phenomenaListItem.map((phenomenon) => (
        <p>
          {phenomenon}
          {phenomenon.endsWith(observationStatuses[2]) && "(Blast Off!!!)"}
        </p>
      ))}
    </div>
  );
}

ReactDOM.render(<App />, document.getElementById("root"));

//   const randomObservationStatus =
//     observationStatuses[randomInt(0, observationStatuses.length - 1)];

//   const allPhenomena =
//     spacePhenomena.emoji + spacePhenomena.name + randomObservationStatus;

//   const phenomenaListItem = spacePhenomena.map((phenomenon) => {
//     return randomObservationStatus === observationStatuses[2]
//       ? allPhenomena + "Study time!!!"
//       : allPhenomena;
//   });

//   return <div>{phenomenaListItem}</div>;
// }
