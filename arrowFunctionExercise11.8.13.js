/* Task 1: No Parameters: Activate Hyperdrive */

let activateHyperdrive = () => {
  console.log("Hyperdrive activated!");
};
activateHyperdrive();

/* Task 2: Implicit Return: Scan for Lifeforms */

let scanForLife = () => console.log("No lifeforms detected");
scanForLife();

/* Task 3: Implicit Return with Objects: Log Coordinates */

let currentCoordinates = (x, y, z) => console.log(x, y, z);
currentCoordinates(10, 20, 30);

/* Task 4: Understanding `this`: Message from Home Base */

let spacecraft = {
  Name: "Super Rocket",
  receiveMessage: (message) => console.log(`Message received: ${message}`),
};
spacecraft.receiveMessage("Hello, Earth!");

//^^ Works, but if I modify the message to include a "this." method it does not. Example below

let spaceCraft = {
  Name: "Super Rocket",
  Message: "Hello, Earth!",
  receiveMessage: () => console.log(`Message received: ${this.Message}`),
};
spaceCraft.receiveMessage();

//And that is because in an arrow function, the "this." method
// points to the global scope, not the block scope"
