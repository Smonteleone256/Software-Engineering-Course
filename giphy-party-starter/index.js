// look back at the <readme.md> file for some hints //
// working API key //
const giphyApiKey = "MhAodEJIJxQMxW9XqxKjyXfNYdLoOIym";
let searchButton = document.getElementById("search");
let removeButton = document.getElementById("remove");
let searchBar = document.getElementById("type");
let searchTerms = "";

document.addEventListener("DOMContentLoaded", function () {
  searchBar.addEventListener("submit", function (event) {
    event.preventDefault();
  });
  searchButton.addEventListener("click", async function (event) {
    event.preventDefault();
    console.log("clicked");
    console.log(searchBar.value);
    searchTerms = searchBar.value;
    const response = await fetch(
      `https://api.giphy.com/v1/gifs/search?q=${searchTerms}&api_key=MhAodEJIJxQMxW9XqxKjyXfNYdLoOIym`
    );
    const data = await response.json();
    console.log(data);
  });
  removeButton.addEventListener("click", function () {
    location.reload();
  });
});
