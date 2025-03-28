export { inventory, addItem, removeItem, listItem };

const inventory = [];
function addItem(item) {
  inventory.push(item);
}
function removeItem(item) {
  inventory.splice(inventory.indexOf(item), 1);
}
function listItem() {
  console.log(inventory);
}
