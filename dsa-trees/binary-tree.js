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
    this.maxSum = function (root) {
      let maxSum = -Infinity;

      function maxGain(node) {
        if (!node) {
          return 0;
        }

        let leftGain = Math.max(maxGain(node.left), 0);
        let rightGain = Math.max(maxGain(node.right), 0);

        let currentSum = node.val + leftGain + rightGain;
        maxSum = Math.max(maxSum, currentSum);

        return node.val + Math.max(leftGain, rightGain);
      }

      maxGain(root);
      return maxSum;
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

module.exports = { BinaryTree, BinaryTreeNode };
