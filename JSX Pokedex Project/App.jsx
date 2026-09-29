import React from "react";
import pokeCard from "./components/pokeCard";

function App() {
  const [generatedPokemonState, setGeneratedPokemonState] = useState([]);
  useEffect(() => {
    function generatePokemonList() {
      try {
        function pokedex() {
          const pokemonList = [
            {
              id: 373,
              name: "Salamence",
              type: "dragon/flying",
              base_experience: 270,
            },
            { id: 4, name: "Charmander", type: "fire", base_experience: 62 },
            { id: 7, name: "Squirtle", type: "water", base_experience: 63 },
            {
              id: 12,
              name: "Butterfree",
              type: "bug/flying",
              base_experience: 178,
            },
            { id: 25, name: "Pikachu", type: "electric", base_experience: 112 },
            {
              id: 39,
              name: "Jigglypuff",
              type: "normal/fairy",
              base_experience: 95,
            },
            {
              id: 94,
              name: "Gengar",
              type: "ghost/poison",
              base_experience: 225,
            },
            { id: 133, name: "Eevee", type: "normal", base_experience: 65 },
          ];

          function randomIntUrl(min, max) {
            const minCeiled = Math.ceil(min);
            const maxFloored = Math.floor(max);
            return Math.floor(
              Math.random() * (maxFloored - minCeiled + 1) + minCeiled,
            );
          }

          async function generatePokemon() {
            try {
              const response = await fetch(
                "https://pokeapi.co/api/v2/pokemon/?limit=6000",
              );
              let generatedPokemon = response.ok ? [] : pokemonList;
              const data = await response.json();

              const urlInt1 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt2 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt3 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt4 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt5 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt6 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt7 = data.results[randomIntUrl(0, 1350)].url;
              const urlInt8 = data.results[randomIntUrl(0, 1350)].url;

              const pokemonPromises = [
                fetch(urlInt1).then((response) => response.json()),
                fetch(urlInt2).then((response) => response.json()),
                fetch(urlInt3).then((response) => response.json()),
                fetch(urlInt4).then((response) => response.json()),
                fetch(urlInt5).then((response) => response.json()),
                fetch(urlInt6).then((response) => response.json()),
                fetch(urlInt7).then((response) => response.json()),
                fetch(urlInt8).then((response) => response.json()),
              ];

              // const generatedPokemon = await Promise.all(pokemonPromises).then(
              //   (responses) => responses.map((response) => response.json()),
              // );

              setGeneratedPokemon(generatedPokemon);
            } catch (error) {
              console.error(error);
            }
          }
          // // id, name, type, base_experience
          // generatePokemon();
          // console.log(generatedPokemon);
        }
      } catch (error) {
        console.error(error);
      }
    }
    generatePokemon();
  }, []);

  return (
    <div>
      <ol>
        {generatePokemon.map((mon) => (
          <li key={mon.id}>
            <PokeCard />
          </li>
        ))}
      </ol>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
