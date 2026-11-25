export { inventory, addItems, removeItems, listItems };

const inventory = [];
function addItems(...items) {
  for (const item of items) {
    inventory.push(item);
  }
  console.log(inventory);
}
function removeItems(...items) {
  for (const item of items) {
    inventory.splice(inventory.indexOf(item), 1);
  }
  console.log(inventory);
}
function listItems() {
  console.log(inventory);
}
