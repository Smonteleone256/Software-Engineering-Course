const spoonacularAPIKEY = "7fef42c9428544aab3bbc37953725fe7";

document.addEventListener("DOMContentLoaded", function () {
  const button = document.getElementById("generate-button");
  const displayDiv = document.getElementById("display-div");
  button.addEventListener("click", function () {
    getRandomRecipe();
  });

  async function getRandomRecipe() {
    let newDiv = document.createElement("div");
    let newH3 = document.createElement("h3");

    try {
      const url = `https://api.spoonacular.com/recipes/random?apiKey=${spoonacularAPIKEY}`;

      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw { message: errorData.message };
      }
      const data = await response.json();
      console.log(data);

      displayDiv.innerHTML = "";

      newH3.innerHTML = data.recipes[0].title;
      displayDiv.appendChild(newH3);

      newDiv.innerHTML = data.recipes[0].summary;
      displayDiv.appendChild(newDiv);
    } catch (error) {
      displayDiv.innerHTML = "";
      newH3.innerHTML = "Error";
      displayDiv.appendChild(newH3);
      newDiv.innerHTML = error.message;
      displayDiv.appendChild(newDiv);
    }
  }
});
