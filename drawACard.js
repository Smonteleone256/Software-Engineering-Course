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
let drawButton = document.getElementById("draw-button");
//When page loads run:
function acquireDeck() {
  fetch("https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1")
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      deckID = data.deck_id;
    })
    .catch((err) => console.error(err));
}

//Then on-click run:
function newCard() {
  fetch(`https://deckofcardsapi.com/api/deck/${deckID}/draw/?count=1`)
    .then((response) => response.json())
    .then((data) => {
      console.log(data);
      cardCount++;
      let img = document.getElementById("img");
      const newImg = new Image(50, 50);
      newImg.src = `${data.cards[0].image}`;
      img.appendChild(newImg);
      //<document.getElementById("image-holder").innerHTML = "<img src='image.png' />";
    })
    .catch((err) => console.error(err));
}

function draw() {
  if (cardCount === 51) {
    console.log("51");
    drawButton.innerText = "New Deck!";
    newCard();
  } else if (cardCount === 52) {
    console.log("52");
    window.location.reload();
  } //reloads webpage
  else {
    console.log("new");
    newCard();
  }
}

drawButton.addEventListener("click", draw);
acquireDeck();

//
//
// fetch("https://deckofcardsapi.com/api/deck/new/shuffle/?deck_count=1")
// .then((response) => response.json())
// .then((data) => console.log(data))
// .catch((err) => console.error(err));
