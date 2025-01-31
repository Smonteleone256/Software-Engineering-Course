// function randomIntUrl(min, max) {
//   const minCeiled = Math.ceil(min);
//   const maxFloored = Math.floor(max);
//   return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
// }

// //Part 2
// fetch("https://pokeapi.co/api/v2/pokemon/?limit=6000")
//   .then((response) => response.json())
//   .then((data) => {
//     urlInt1 = data.results[randomIntUrl(0, 1302)].url;
//     urlInt2 = data.results[randomIntUrl(0, 1302)].url;
//     urlInt3 = data.results[randomIntUrl(0, 1302)].url;
//     fetch(`${urlInt1}`)
//       .then((response) => response.json())
//       .then((data) => console.log(data));
//     fetch(`${urlInt2}`)
//       .then((response) => response.json())
//       .then((data) => console.log(data));
//     fetch(`${urlInt3}`)
//       .then((response) => response.json())
//       .then((data) => console.log(data));
//     console.log(`Randomly picked URLs: ${urlInt1}, ${urlInt2}, ${urlInt3}`);
//   })
//   .catch((error) => console.log(error));

// //Part 3

// function randomIntUrl(min, max) {
//   const minCeiled = Math.ceil(min);
//   const maxFloored = Math.floor(max);
//   return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
// }

// fetch("https://pokeapi.co/api/v2/pokemon/?limit=6000")
//   .then((response) => response.json())
//   .then((data) => {
//     urlInt1 = data.results[randomIntUrl(0, 1302)].url;
//     urlInt2 = data.results[randomIntUrl(0, 1302)].url;
//     urlInt3 = data.results[randomIntUrl(0, 1302)].url;
//     fetch(`${urlInt1}`)
//       .then((response) => response.json())
//       .then((data) => {
//         fetch(data.species.url)
//           .then((response) => response.json())
//           .then((data) => {
//             console.log(data.name);
//             for (i = 0; i < data.flavor_text_entries.length; i++) {
//               if (data.flavor_text_entries[i].language.name === "en") {
//                 console.log(data.flavor_text_entries[i].flavor_text);
//                 break;
//               }
//             }
//           });
//       });

//     fetch(`${urlInt2}`)
//       .then((response) => response.json())
//       .then((data) => {
//         fetch(data.species.url)
//           .then((response) => response.json())
//           .then((data) => {
//             console.log(data.name);
//             for (i = 0; i < data.flavor_text_entries.length; i++) {
//               if (data.flavor_text_entries[i].language.name === "en") {
//                 console.log(data.flavor_text_entries[i].flavor_text);
//                 break;
//               }
//             }
//           });
//       });

//     fetch(`${urlInt3}`)
//       .then((response) => response.json())
//       .then((data) => {
//         fetch(data.species.url)
//           .then((response) => response.json())
//           .then((data) => {
//             console.log(data.name);
//             for (i = 0; i < data.flavor_text_entries.length; i++) {
//               if (data.flavor_text_entries[i].language.name === "en") {
//                 console.log(data.flavor_text_entries[i].flavor_text);
//                 break;
//               }
//             }
//           });
//       });
//   });

// // Build an HTML page that lets you click on a button to generate data from three randomly chosen pokemon.
// // Include the name of the pokemon, an image of the pokemon, and the description of its species which
// // you found in 3.

// //Part 4

// let startersPresent = false;
let starters = document.getElementById("starters");

function randomIntUrl(min, max) {
  const minCeiled = Math.ceil(min);
  const maxFloored = Math.floor(max);
  return Math.floor(Math.random() * (maxFloored - minCeiled + 1) + minCeiled);
}

function newStarter() {
  // if ((startersPresent = true)) {
  //   document.getElementById("img1").src = "";
  //   document.getElementById("img2").src = "";
  //   document.getElementById("img3").src = "";
  //   document.getElementById("p1").textContent = "";
  //   document.getElementById("p2").textContent = "";
  //   document.getElementById("p3").textContent = "";
  //   startersPresent = false;
  // } else {
  fetch("https://pokeapi.co/api/v2/pokemon/?limit=6000")
    .then((response) => response.json())
    .then((data) => {
      urlInt1 = data.results[randomIntUrl(0, 1302)].url;
      urlInt2 = data.results[randomIntUrl(0, 1302)].url;
      urlInt3 = data.results[randomIntUrl(0, 1302)].url;
      fetch(`${urlInt1}`)
        .then((response) => response.json())
        .then((data) => {
          let img = document.getElementById("img1");
          const newImg = new Image(151, 151);
          newImg.src = `${data.sprites.front_default}`;
          img.appendChild(newImg);
          fetch(data.species.url)
            .then((response) => response.json())
            .then((data) => {
              document.getElementById("p1").textContent += `${data.name}`;
              for (i = 0; i < data.flavor_text_entries.length; i++) {
                if (data.flavor_text_entries[i].language.name === "en") {
                  document.getElementById(
                    "p1"
                  ).textContent += `${data.flavor_text_entries[i].flavor_text}`;
                  break;
                }
              }
            });
        });

      fetch(`${urlInt2}`)
        .then((response) => response.json())
        .then((data) => {
          let img = document.getElementById("img2");
          const newImg = new Image(151, 151);
          newImg.src = `${data.sprites.front_default}`;
          img.appendChild(newImg);
          fetch(data.species.url)
            .then((response) => response.json())
            .then((data) => {
              document.getElementById("p2").textContent += `${data.name}`;
              for (i = 0; i < data.flavor_text_entries.length; i++) {
                if (data.flavor_text_entries[i].language.name === "en") {
                  document.getElementById(
                    "p2"
                  ).textContent += `${data.flavor_text_entries[i].flavor_text}`;
                  break;
                }
              }
            });
        });

      fetch(`${urlInt3}`)
        .then((response) => response.json())
        .then((data) => {
          let img = document.getElementById("img3");
          const newImg = new Image(151, 151);
          newImg.src = `${data.sprites.front_default}`;
          img.appendChild(newImg);
          fetch(data.species.url)
            .then((response) => response.json())
            .then((data) => {
              document.getElementById("p3").textContent += `${data.name}`;
              for (i = 0; i < data.flavor_text_entries.length; i++) {
                if (data.flavor_text_entries[i].language.name === "en") {
                  document.getElementById(
                    "p3"
                  ).textContent += `${data.flavor_text_entries[i].flavor_text}`;
                  break;
                }
              }
            });
        });
    });
  console.log("hi");
  // }
}

// function checkStartersPresent() {
//   if (startersPresent === true) {
//     console.log("true!");
//     document.getElementById("img1").src = "";
//     document.getElementById("img2").src = "";
//     document.getElementById("img3").src = "";
//     document.getElementById("p1").textContent = "";
//     document.getElementById("p2").textContent = "";
//     document.getElementById("p3").textContent = "";
//     newStarter();
//   } else {
//     console.log("false!");
//     newStarter();
//   }
// }

starters.addEventListener("click", newStarter);

// # Page breaks are treated just like newlines.
// # Soft hyphens followed by newlines vanish.
// # Letter-hyphen-newline becomes letter-hyphen, to preserve real
// # hyphenation.
// # Any other newline becomes a space.
// html = flavor_text.replace(u'\f',       u'\n') \
//                   .replace(u'\u00ad\n', u'') \
//                   .replace(u'\u00ad',   u'') \
//                   .replace(u' -\n',     u' - ') \
//                   .replace(u'-\n',      u'-') \
//                   .replace(u'\n',       u' ')
