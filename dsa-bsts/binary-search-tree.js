class Node {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

class BinarySearchTree {
  constructor(root = null) {
    this.root = root;
  }

  /** insert(val): insert a new node into the BST with value val.
   * Returns the tree. Uses iteration. */

  insert(val) {
    let currentNode = this.root;
    while (currentNode) {
      if (val === currentNode) return console.log("Node already exists");
    }
    if (val > currentNode && !currentNode.right) {
      val === currentNode.right;
      return;
    } else if (val < currentNode && !currentNode.left) {
      val === currentNode.left;
      return;
    } else if (val > currentNode) {
      currentNode = currentNode.right;
    } else {
      currentNode = currentNode.left;
    }
  }

  /** insertRecursively(val): insert a new node into the BST with value val.
   * Returns the tree. Uses recursion. */

  insertRecursively(val) {}

  find(val) {
    let currentNode = this;
    while (currentNode) {
      if (currentNode.val === val) return currentNode;
      currentNode =
        val < currentNode.val ? currentNode.left : currentNode.right;
    }
  }

  findRecursively(val) {
    let currentNode = this;
    if (val === currentNode.val) return currentNode;
    if (val < currentNode.val)
      return this.findRecursively(val, currentNode.left);
    if (val > currentNode.val)
      return this.findRecursively(val, currentNode.right);
  }

  dfsPreOrder(node = this.root) {
    let visited = [];
    visited.push(node.val);
    this.dfsPreOrder(node.left);
    this.dfsPreOrder(node.right);

    return visited;
  }

  dfsInOrder(node = this.root) {
    let visited = [];
    this.dfsPreOrder(node.left);
    visited.push(node.val);
    this.dfsPreOrder(node.right);

    return visited;
  }

  dfsPostOrder(node = this.root) {
    let visited = [];
    this.dfsPreOrder(node.left);
    this.dfsPreOrder(node.right);
    visited.push(node.val);

    return visited;
  }

  bfs() {
    if (!this.root) return null;
    let queue = [this.root];
    let visited = [];
    while (queue.length) {
      visited.push(queue[0].val);
      let currentNode = queue.shift();
      if (currentNode.left) queue.push(currentNode.left);
      if (currentNode.right) queue.push(currentNode.right);
    }
    return visited;
  }
}

let myBST = new BinarySearchTree(13);
myBST.insert(15);
myBST.insert(20);
myBST.insert(10);
myBST.insert(12);
myBST.insert(1);
myBST.insert(5);
myBST.insert(50);

console.log(myBST);

/** Further Study!
 * remove(val): Removes a node in the BST with the value val.
 * Returns the removed node. */

//   remove(val) {}

//   /** Further Study!
//    * isBalanced(): Returns true if the BST is balanced, false otherwise. */

//   isBalanced() {}

//   /** Further Study!
//    * findSecondHighest(): Find the second highest value in the BST, if it exists.
//    * Otherwise return undefined. */

//   findSecondHighest() {}
// }

module.exports = BinarySearchTree;
