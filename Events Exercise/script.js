document.addEventListener("DOMContentLoaded", function () {
  let ID = 0;
  const allBox = document.querySelectorAll("box");
  const form = document.getElementById("color-form");
  const input = document.getElementById("color-input");
  const box = document.getElementsByClassName("box");

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    allBox.color = input.value;
    console.log(`${input.value} is the new box color`);
  });

  const newBox = document.getElementById("new-box-button");

  newBox.addEventListener("click", function () {
    let boxID = ID;
    const createBox = document.createElement("div");
    createBox.classList.add("box");
    const boxHolder = document.getElementById("box-container");
    boxHolder.appendChild(createBox);
    createBox.innerText = boxID;
    ID++;
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "n") {
      const createBox = document.createElement("div");
      createBox.classList.add("box");
      const boxHolder = document.getElementById("box-container");
      boxHolder.appendChild(createBox);
    }
  });
  box.addEventListener("dblclick", function () {
    box.remove();
  });
});
