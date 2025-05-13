/** BinaryTreeNode: node for a general tree. */

class BinaryTreeNode {
  constructor(val, left = null, right = null) {
    this.val = val;
    this.left = left;
    this.right = right;
  }
}

class BinaryTree {
  constructor(root = null) {
    this.root = root;

    this.minDepth = function () {
      if (!this.root) return 0;

      function minDepthHelper(node) {
        if (node === null) return 0;
        if (node.left === null && node.right === null) return 1;
        if (node.left === null) return minDepthHelper(node.right);
        if (node.right === null) return minDepthHelper(node.left);
        return Math.min(minDepthHelper(node.left), minDepthHelper(node.right));
      }

      return minDepthHelper(this.root) + 1;
    };

    this.maxDepth = function () {
      if (!this.root) return 0;

      function maxDepthHelper(node) {
        if (node === null) return 0;
        if (node.left === null && node.right === null) return 1;
        if (node.left === null) return maxDepthHelper(node.right) + 1;
        if (node.right === null) return maxDepthHelper(node.left) + 1;
        return Math.max(maxDepthHelper(node.left), maxDepthHelper(node.right));
      }

      return maxDepthHelper(this.root) + 1;
    };

    // Returns the maximum path sum in the subtree with the given root.
    // Also updates 'result' with the maximum path sum.
    this.maxSum = function (root, result) {
      // Base case: return 0 for a null node
      if (root === null) {
        return 0;
      }

      // Calculate maximum path sums for left and right subtrees
      const leftSum =
        root.left === null
          ? 0
          : Math.max(0, this.maxSum.bind(this)(root.left, result));
      const rightSum =
        root.right === null
          ? 0
          : Math.max(0, this.maxSum.bind(this)(root.right, result));

      // Update 'result' with the maximum path sum passing through the current node
      result.value = Math.max(result.value, leftSum + rightSum + root.val);

      // Return the maximum path sum rooted at this node
      return root.val + Math.max(leftSum, rightSum);
    };

    // Returns the maximum path sum in the tree with the given root
    this.maxPathSum = function (root) {
      const result = { value: root.val };

      // Compute maximum path sum and store it in 'result'
      this.maxSum(root, result);

      return result.value;
    };

    this.nextLarger = function (lowerBound) {
      if (!this.root) return null;

      let queue = [this.root];
      let closest = null;

      while (queue.length) {
        let currentNode = queue.shift();
        let currentVal = currentNode.val;
        let higherThanLowerBound = currentVal > lowerBound;
        let shouldReassignClosest = currentVal < closest || closest === null;

        if (higherThanLowerBound && shouldReassignClosest) {
          closest = currentVal;
        }

        if (currentNode.left) queue.push(currentNode.left);
        if (currentNode.right) queue.push(currentNode.right);
      }

      return closest;
    };
  }
}

let myBinaryTree = new BinaryTree();

myBinaryTree.root = new BinaryTreeNode(10);
myBinaryTree.root.left = new BinaryTreeNode(5);
myBinaryTree.root.right = new BinaryTreeNode(15);
myBinaryTree.root.left.left = new BinaryTreeNode(3);
myBinaryTree.root.left.right = new BinaryTreeNode(7);
myBinaryTree.root.right.left = new BinaryTreeNode(13);
myBinaryTree.root.right.left.left = new BinaryTreeNode(12);

console.log(myBinaryTree);
myBinaryTree.maxSum();

let myEmptyTree = new BinaryTree();
console.log(myEmptyTree);

/** maxSum(): return the maximum sum you can obtain by traveling along a path in the tree.
 * The path doesn't need to start at the root, but you can't visit a node more than once. */

myBinaryTree.maxSum();

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
