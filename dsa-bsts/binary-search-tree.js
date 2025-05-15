class Node {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

class BinarySearchTree {
  constructor(root = null) {
    this.root = root ? new Node(root) : null;
  }

  insert(val) {
    if (!this.root) {
      this.root = new Node(val);
      return this;
    }

    let currentNode = this.root;
    while (true) {
      if (val === currentNode.val) {
        console.log("Node already exists");
        return this;
      }

      if (val < currentNode.val) {
        if (!currentNode.left) {
          currentNode.left = new Node(val);
          return this;
        }
        currentNode = currentNode.left;
      } else {
        if (!currentNode.right) {
          currentNode.right = new Node(val);
          return this;
        }
        currentNode = currentNode.right;
      }
    }
  }

  /** insertRecursively(val): insert a new node into the BST with value val.
   * Returns the tree. Uses recursion. */

  insertRecursively(val) {
    if (!this.root) {
      this.root = new Node(val);
      return this;
    }
  }

  find(val) {
    if (!this.root) return undefined;
    let currentNode = this.root;
    while (currentNode) {
      if (currentNode.val === val) return currentNode;
      currentNode =
        val < currentNode.val ? currentNode.left : currentNode.right;
    }
    return undefined;
  }

  findRecursively(val, node = this.root) {
    if (!node) return undefined;
    if (val === node.val) return node;
    if (val < node.val) return this.findRecursively(val, node.left);
    if (val > node.val) return this.findRecursively(val, node.right);
  }

  dfsPreOrder(node = this.root) {
    let visited = [];
    if (node) {
      visited.push(node.val);
      this.dfsPreOrder(node.left);
      this.dfsPreOrder(node.right);
    }

    return visited;
  }

  dfsInOrder(node = this.root) {
    let visited = [];
    if (node) {
      this.dfsInOrder(node.left);
      visited.push(node.val);
      this.dfsInOrder(node.right);
    }

    return visited;
  }

  dfsPostOrder(node = this.root, visited = []) {
    if (node) {
      this.dfsPostOrder(node.left);
      this.dfsPostOrder(node.right);
      visited.push(node.val);
    }

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
myBST.dfsPostOrder();

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
