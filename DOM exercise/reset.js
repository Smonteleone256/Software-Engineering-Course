document.getElementById("task6").value = ""; // Ensure input is empty on page load

document.querySelector(".task #task1").innerText = "Changed using 'innerText'.";

document.querySelector(".task #task2").innerHTML = "<button>Submit</button>";

document.body.style.backgroundColor = "#232323";

let items = document.getElementsByClassName("item");
for (let i = 0; i < items.length; i++) {
  items[i].style.border = "thick solid #0000FF";
}

document.querySelector(".task #task5").href = "https://www.springboard.com/";

document.getElementById("task6").value = "DOM Master";

document.getElementById("task7").classList.add("new-class");

let myButton = document.createElement("button");
document.getElementById("task8").append(myButton);

document.querySelector(".task #task9").remove();
