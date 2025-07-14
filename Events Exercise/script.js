let inputValue = "";

document.addEventListener("DOMContentLoaded", function () {
  let ID = 0;

  const form = document.getElementById("color-form");
  const input = document.getElementById("color-input");
  const boxContainer = document.getElementById("box-container");
  const newBox = document.getElementById("new-box-button");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    inputValue = input.value;
    const allBox = Array.from(boxContainer.children);
    allBox.forEach((box) => {
      box.style.backgroundColor = input.value;
      if (
        box.style.backgroundColor === input.value ||
        box.style.backgroundColor !== ""
      ) {
        console.log("Valid color:", input.value);
      } else {
        alert("Invalid color!");
      }
    });
    console.log(`${input.value} is the new box color`);
  });

  newBox.addEventListener("click", function () {
    let boxID = ID;
    const createBox = document.createElement("div");
    createBox.classList.add("box");
    const boxHolder = document.getElementById("box-container");
    boxHolder.appendChild(createBox);
    createBox.id = "newBox";
    createBox.innerText = boxID;
    createBox.style.fontSize = "300%";
    if (!(inputValue === "")) {
      createBox.style.backgroundColor = inputValue;
    }
    ID++;

    createBox.addEventListener("dblclick", function () {
      boxContainer.removeChild(createBox);
    });

    createBox.addEventListener("mouseover", (event) => {
      createBox.innerText = `${event.offsetX}, ${event.offsetY}`;
      createBox.addEventListener("mouseout", (event) => {
        createBox.innerText = boxID;
      });
    });
  });

  document.addEventListener("keydown", function (event) {
    if (!(document.activeElement.tagName === "INPUT")) {
      if (event.key === "n") {
        let boxID = ID;
        const createBox = document.createElement("div");
        createBox.classList.add("box");
        const boxHolder = document.getElementById("box-container");
        boxHolder.appendChild(createBox);
        createBox.id = "newBox";
        createBox.innerText = boxID;
        createBox.style.fontSize = "300%";
        if (!(inputValue === "")) {
          createBox.style.backgroundColor = inputValue;
        }
        ID++;

        createBox.addEventListener("dblclick", function () {
          boxContainer.removeChild(createBox);
        });

        createBox.addEventListener("mouseover", (event) => {
          createBox.innerText = `${event.offsetX}, ${event.offsetY}`;
          createBox.addEventListener("mouseout", (event) => {
            createBox.innerText = boxID;
          });
        });
      }
    }
  });
});
