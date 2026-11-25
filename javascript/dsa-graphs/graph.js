class Node {
  constructor(value, adjacent = new Set()) {
    this.value = value;
    this.adjacent = adjacent;
  }
}

class Graph {
  constructor() {
    this.nodes = new Set();
  }

  addVertex(vertex) {
    this.nodes.add(vertex);
  }

  addVertices(vertexArray) {
    for (let vertex of vertexArray) {
      this.addVertex(vertex);
    }
  }

  addEdge(v1, v2) {
    v1.adjacent.add(v2);
    v2.adjacent.add(v1);
  }

  removeEdge(v1, v2) {
    v1.adjacent.delete(v2);
    v2.adjacent.delete(v1);
  }

  removeVertex(vertex) {
    if (vertex.adjacent) {
      vertex.adjacent.forEach((edge) => {
        edge.adjacent.delete(vertex);
      });
    }
    this.nodes.delete(vertex);
  }

  breadthFirstSearch(start) {
    let queue = [start];
    let nodeValues = new Set(queue);
    while (queue.length) {
      let current = queue.shift();
      for (let adjacent of current.adjacent) {
        if (!nodeValues.has(adjacent)) {
          queue.push(adjacent);
          nodeValues.add(adjacent);
        }
      }
    }
    return nodeValues;
  }

  depthFirstSearch(start) {
    let stack = [start];
    let nodeValues = new Set(stack);
    while (stack.length) {
      let current = stack.pop();
      for (let adjacent of current.adjacent) {
        if (!nodeValues.has(adjacent)) {
          stack.push(adjacent);
          nodeValues.add(adjacent);
        }
      }
    }
    return nodeValues;
  }
}

module.exports = { Graph, Node };
