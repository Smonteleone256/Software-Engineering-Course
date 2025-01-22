//Part one API unaccessible
let numAPI = "http://numbersapi.com/3?json";

function setup() {
  fetch(numAPI)
    .then((data) => console.log(data))
    .catch((err) => console.log(err));
}

fetch("https://numbersapi.com/3?json");

//Part 2
//Step 1
fetch("https://deckofcardsapi.com/api/deck/new/draw/?count=1")
  .then((response) => response.json())
  .then((data) => console.log(data.cards[0].value, "of", data.cards[0].suit))
  .catch((err) => console.error(err));

//Step 2
fetch("https://deckofcardsapi.com/api/deck/new/draw/?count=1")
  .then((response) => response.json())
  .then((data) => {
    console.log(data.cards[0].value, "of", data.cards[0].suit);
    let deck = data.deck_id;
    return fetch(`https://deckofcardsapi.com/api/deck/${deck}/draw/?count=1`);
  })
  .then((response) => response.json())
  .then((data) => console.log(data.cards[0].value, "of", data.cards[0].suit))
  .catch((err) => console.error(err));
//
//
//
//
//
//
//Step 3
// Psuedocode: When the page loads, call the card API to get a new deckID,
// Using that deckID, on each click, run fetch function to draw another card.
// once 52 cards have been drawn (deck exhausted), have button transform to refresh page
// each time card is drawn, img of card needs to be displayed
//
//
//
let deckID;
let cardCount = 0;

//When page loads run:
function acquireDeck() {
  fetch("https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1")
    .then((response) => response.json())
    .then((data) => (deckID = data.deck_id))
    .catch((err) => console.error(err));
}

//Then on-click run:
function newCard() {
  fetch(`https://deckofcardsapi.com/api/deck/${deckID}/draw/?count=1`)
    .then((response) => response.json())
    .then((data) => {
      cardCount++;
      let img = document.getElementById("img");
      const newImg = new Image(900, 900);
      newImg.src = `${data.cards[0].image}`;
      img.appendChild(newImg);
      //<document.getElementById("image-holder").innerHTML = "<img src='image.png' />";
    })
    .catch((err) => console.error(err));
}

function draw() {
  if (cardCount === 51) {
    document.getElementById("draw-button").innerText = "New Deck!";
    document.getElementById("draw-button").onclick = newCard();
  } else if (cardCount === 52) {
    document.getElementById("draw-button").onclick = location.reload();
  } //reloads webpage
  else {
    document.getElementById("draw-button").onclick = newCard();
  }
}

//

//
//
//
//
//
//
//
//Part 3
fetch("https://pokeapi.co/api/v2/pokemon/salamence")
  .then((response) => response.json())
  .then((data) => console.log(data))
  .catch((err) => console.error(err));
