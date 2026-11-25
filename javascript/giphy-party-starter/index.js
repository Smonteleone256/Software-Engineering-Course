const giphyApiKey = "MhAodEJIJxQMxW9XqxKjyXfNYdLoOIym";
let searchButton = document.getElementById("search");
let removeButton = document.getElementById("remove");
let searchBar = document.getElementById("type");
let searchTerms = "";
let gifRepo = document.getElementById("GIFList");

function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

document.addEventListener("DOMContentLoaded", function () {
  searchBar.addEventListener("submit", function (event) {
    event.preventDefault();
  });
  searchButton.addEventListener("click", async function (event) {
    event.preventDefault();
    console.log(searchBar.value);
    searchTerms = searchBar.value;
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?q=${searchTerms}&api_key=${giphyApiKey}`
    );
    const data = await response.json();
    console.log(data);
    const newGif = new Image(151, 151);
    newGif.src = data.data[getRandomInt(0, 50)].url;
    gifRepo.appendChild(newGif);
  });
  removeButton.addEventListener("click", function () {
    location.reload();
  });
});

//data[getRandomInt(0, 50)].url
