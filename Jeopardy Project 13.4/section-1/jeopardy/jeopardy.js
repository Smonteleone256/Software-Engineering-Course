// categories is the main data structure for the app; it looks like this:

//  [
//    { title: "Math",
//      clues: [
//        {question: "2+2", answer: 4, showing: null},
//        {question: "1+1", answer: 2, showing: null}
//        ...
//      ],
//    },
//    { title: "Literature",
//      clues: [
//        {question: "Hamlet Author", answer: "Shakespeare", showing: null},
//        {question: "Bell Jar Author", answer: "Plath", showing: null},
//        ...
//      ],
//    },
//    ...
//  ]

// working APIs
// https://rithm-jeopardy.herokuapp.com/api/category?id=4
// https://rithm-jeopardy.herokuapp.com/api/categories?count=100

// async function request() {
//   fetch(`https://rithm-jeopardy.herokuapp.com/api/categories?count=100`)
//     .then((response) => response.json())
//     .then((data) => console.log(data));
// }

//get all 14 CATEGORIES ^

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

/** Wipe the current Jeopardy board, show the loading spinner,
 * and update the button used to fetch data.
 */

function removeElementsByClass(className) {
  const elements = document.getElementsByClassName(className);
  while (elements.length > 0) {
    elements[0].parentNode.removeChild(elements[0]);
  }
}
function showLoadingView() {
  removeElementsByClass("question");
  removeElementsByClass("category");
  //show spinner
}

/** Remove the loading spinner and update the button used to fetch data. */

function hideLoadingView() {}

/** Start game:
 *
 * - get random category Ids
 * - get data for each category
 * - create HTML table
 * */

function setupAndStart() {
  start.addEventListener("click", function () {
    if (start.innerText === "Restart!") {
      showLoadingView();
      start.innerText = "Start!";
    } else {
      fillTable();
      start.innerText = "Restart!";
    }
  });
}

document.addEventListener("DOMContentLoaded", function () {
  start.addEventListener("click", async function (event) {
    event.preventDefault();
    setupAndStart();
    //functions already made
  });
});
