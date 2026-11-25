/** TreeNode: node for a general tree. */

class TreeNode {
  constructor(val, children = []) {
    this.val = val;
    this.children = children;
  }
}

class Tree {
  constructor(root = null, children = []) {
    this.root = root;
    this.children = children;

    this.sumValues = function () {
      if (!root) {
        return 0;
      }
      let sum = root;
      const treeStack = this.children;
      while (treeStack.length) {
        const current = treeStack.pop();
        if (current.val !== null) {
          sum += current.val;
          for (let child of current.children) {
            treeStack.push(child);
          }
        }
      }
      return sum;
    };

    this.countEvens = function () {
      let evenCount = 0;
      if (root % 2 === 0) {
        evenCount++;
      }
      const treeStack = this.children;
      while (treeStack.length) {
        const current = treeStack.pop();
        if (current.val % 2 === 0) {
          evenCount++;
          for (let child of current.children) {
            treeStack.push(child);
          }
        } else {
          for (let child of current.children) {
            treeStack.push(child);
          }
        }
      }
      return evenCount;
    };

    this.numGreater = function (lowerBound) {
      let greaterCount = 0;
      if (root > lowerBound) {
        greaterCount++;
      }
      const treeStack = this.children;
      while (treeStack.length) {
        const current = treeStack.pop();
        if (current.val > lowerBound) {
          greaterCount++;
          for (let child of current.children) {
            treeStack.push(child);
          }
        } else {
          for (let child of current.children) {
            treeStack.push(child);
          }
        }
      }
      return greaterCount;
    };
  }
}

let myTree = new Tree(5, [
  new TreeNode(2, [new TreeNode(6), new TreeNode(11)]),
  new TreeNode(7),
]);

/** sumValues(): add up all of the values in the tree. */

myTree.sumValues();
//output: 31

/** countEvens(): count all of the nodes in the tree with even values. */

myTree.countEvens();
//output: 2

/** numGreater(lowerBound): return a count of the number of nodes
 * whose value is greater than lowerBound. */

myTree.numGreater(5);
//output: 3

module.exports = { Tree, TreeNode };
