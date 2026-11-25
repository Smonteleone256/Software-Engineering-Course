function getRandomInteger(min, max) {
  min = Math.ceil(min); // Ensure min is rounded up to the nearest whole number
  max = Math.floor(max); // Ensure max is rounded down to the nearest whole number
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
//random number helper

let categories = new Set([]);

async function getCategoryIds() {
  const response = await fetch(
    `https://rithm-jeopardy.herokuapp.com/api/categories?count=100`
  );
  const data = await response.json();
  while (categories.size <= 5) {
    categories.add(data[getRandomInteger(0, 13)].id);
  }
  ///returns set of categories, using  math.random, get random assortment of 6 categories
}

async function getCategory(catId) {
  const response = await fetch(
    `https://rithm-jeopardy.herokuapp.com/api/category?id=${catId}`
  );
  const data = await response.json();
  return data;
} // Returns object with data about a category

const catList = document.getElementById("categoryList");
const qCollection = document.getElementById("questions");
const qList = qCollection.children;
const questionInfo = [];
const question = qCollection.getElementsByTagName("td");
const start = document.getElementById("start");

function handleClick() {
  for (let i = 0; i < question.length; i++) {
    question[i].addEventListener("click", function () {
      console.log("click!");
      if (questionInfo[i].showing === null) {
        this.innerText = questionInfo[i].question;
        questionInfo[i].showing = "question";
      } else if (questionInfo[i].showing === "question") {
        this.innerText = questionInfo[i].answer;
        questionInfo[i].showing = "answer";
      }
    });
  }
}

async function fillTable() {
  await getCategoryIds();
  let questionCounter = 0;
  let catCounter = 0;
  for (const id of categories) {
    let currentCat = await getCategory(id);
    const createCat = document.createElement("td");
    catList.appendChild(createCat);
    createCat.innerText = currentCat.title.toUpperCase();
    createCat.classList.add("category");
    for (i = 0; i <= 4; i++) {
      currentCat.clues.showing = null;
      if (i === 0 && catCounter === 0) {
        questionInfo.push(currentCat.clues[questionCounter]);
      } else if (i === 0 && catCounter > 0) {
        questionInfo[catCounter] = currentCat.clues[questionCounter];
      } else {
        questionInfo[catCounter + 6 * questionCounter] =
          currentCat.clues[questionCounter];
      }
      const createQuest = document.createElement("td");
      qList[i].appendChild(createQuest);
      createQuest.innerText = "?";
      createQuest.classList.add("question");
      questionCounter++;
      if (questionCounter === 5) {
        questionCounter = 0;
      }
    }
    catCounter++;
    questionInfo.forEach((question) => {
      question.showing = null;
    });
  }
  handleClick();
}

function removeElementsByClass(className) {
  const elements = document.getElementsByClassName(className);
  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }
}

const loadingSpinner = document.getElementById("loadingSpinner");

function showSpinner() {
  loadingSpinner.style.display = "block"; // Or 'flex', 'grid' depending on layout
}

function hideSpinner() {
  loadingSpinner.style.display = "none";
}
function showLoadingView() {
  start.style.display = "none";
  start.removeEventListener("click", startButton);
  removeElementsByClass("question");
  removeElementsByClass("category");
  categories.clear();
  showSpinner();
  setTimeout(function () {
    hideLoadingView();
  }, 3000);
}

function hideLoadingView() {
  start.style.display = "block";
  hideSpinner();
  start.innerText = "Start!";
  start.addEventListener("click", startButton);
}

function setupAndStart() {
  start.addEventListener("click", startButton);
}

function startButton(event) {
  event.preventDefault();
  if (start.innerText === "Restart!") {
    showLoadingView();
  } else {
    fillTable();
    start.innerText = "Restart!";
  }
}

// showSpinner();

document.addEventListener("DOMContentLoaded", function () {
  hideSpinner();
  setupAndStart();
  //functions already made
});
