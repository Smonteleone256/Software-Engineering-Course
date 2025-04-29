/** BinaryTreeNode: node for a general tree. */

class BinaryTreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

class BinaryTree {
  constructor(root = null, left = null, right = null) {
    this.root = root;
    this.left = left;
    this.right = right;

    this.minDepth = function () {
      let depth = 0;
      if (!this.root) {
        return depth;
      } else {
        depth++;
      }

      const q = [this];
      while (q.length) {
        const node = q.shift();
        if (node.left !== null && node.right !== null) {
          q.push(node.left);
          q.push(node.right);
          depth++;
        } else {
          return depth;
        }
      }
    };

    this.maxDepth = function () {};

    this.maxSum = function () {};

    this.nextLarger = function (lowerBound) {};
  }
}

let myBinaryTree = new BinaryTree(
  10,
  new BinaryTreeNode(5, new BinaryTreeNode(3), new BinaryTreeNode(7)),
  new BinaryTreeNode(15, new BinaryTreeNode(13, new BinaryTreeNode(12)))
);

console.log(myBinaryTree);
myBinaryTree.minDepth();

/** minDepth(): return the minimum depth of the tree -- that is,
 * the length of the shortest path from the root to a leaf. */

myBinaryTree.minDepth();

/** maxDepth(): return the maximum depth of the tree -- that is,
 * the length of the longest path from the root to a leaf. */

myBinaryTree.maxDepth();

/** maxSum(): return the maximum sum you can obtain by traveling along a path in the tree.
 * The path doesn't need to start at the root, but you can't visit a node more than once. */

myBinaryTree.maxSum();

/** nextLarger(lowerBound): return the smallest value in the tree
 * which is larger than lowerBound. Return null if no such value exists. */

myBinaryTree.nextLarger(lowerBound);

/** Further study!
 * areCousins(node1, node2): determine whether two nodes are cousins
 * (i.e. are at the same level but have different parents. ) */

// areCousins(node1, node2) {

// }

// /** Further study!
//  * serialize(tree): serialize the BinaryTree object tree into a string. */

// static serialize() {

// }

// /** Further study!
//  * deserialize(stringTree): deserialize stringTree into a BinaryTree object. */

// static deserialize() {

// }

// /** Further study!
//  * lowestCommonAncestor(node1, node2): find the lowest common ancestor
//  * of two nodes in a binary tree. */

// lowestCommonAncestor(node1, node2) {

// }

module.exports = { BinaryTree, BinaryTreeNode };
