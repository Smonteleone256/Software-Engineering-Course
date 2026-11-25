// function pokedex() {
//   const pokemonList = [
//     { id: 373, name: "Salamence", type: "dragon/flying", base_experience: 270 },
//     { id: 4, name: "Charmander", type: "fire", base_experience: 62 },
//     { id: 7, name: "Squirtle", type: "water", base_experience: 63 },
//     { id: 12, name: "Butterfree", type: "bug/flying", base_experience: 178 },
//     { id: 25, name: "Pikachu", type: "electric", base_experience: 112 },
//     { id: 39, name: "Jigglypuff", type: "normal/fairy", base_experience: 95 },
//     { id: 94, name: "Gengar", type: "ghost/poison", base_experience: 225 },
//     { id: 133, name: "Eevee", type: "normal", base_experience: 65 },
//   ];

//   function randomIntUrl(min, max) {
//     const minCeiled = Math.ceil(min);
//     const maxFloored = Math.floor(max);
//     return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
//   }

//   let generatedPokemon = fetch("https://pokeapi.co/api/v2/pokemon/?limit=6000")
//     ? []
//     : pokemonList;
//   function generatePokemon() {
//     fetch("https://pokeapi.co/api/v2/pokemon/?limit=6000")
//       .then((response) => response.json())
//       .then((data) => {
//         let urlInt1 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt2 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt3 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt4 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt5 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt6 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt7 = data.results[randomIntUrl(0, 1350)].url;
//         let urlInt8 = data.results[randomIntUrl(0, 1350)].url;
//         fetch(`${urlInt1}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt2}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt3}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt4}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt5}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt6}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt7}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//         fetch(`${urlInt8}`)
//           .then((response) => response.json())
//           .then((data) => {
//             generatedPokemon.push(data);
//           });
//       });
//   }
//   // id, name, type, base_experience
//   generatePokemon();
//   console.log(generatedPokemon);
//   return generatedPokemon;
// }

// pokedex();

// return (
//               <h1>{
//               id = data.id,
//               name = data.name,
//               type = data.types[1].type.name
//                 ? data.types[0].type.name + "/" + data.types[1].type.name
//                 : data.types[0].type.name,
//               base_experience = data.base_experience
//             }</h1>);
