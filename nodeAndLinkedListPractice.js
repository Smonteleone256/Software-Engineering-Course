// class Node {
//   constructor(val) {
//     this.val = val;
//     this.next = null;
//   }
// }

// const firstPage = new Node("google.com");
// const secondPage = new Node("reddit.com");
// const thirdPage = new Node("amazon.com");

// firstPage.next = secondPage;
// secondPage.next = thirdPage;

//^longer way, followed by shorter way

class Node {
  constructor(val) {
    this.val = val;
    this.next = null;
  }
}

// const firstPage =
//     new Node("google.com",
//         new Node("reddit.com",
//             new Node("amazon.com")
//         )
//     );

firstPage.next.next.next = "twitter.com";

class linkedList {
  constructor() {
    this.head = null;
    this.tail = null;
  }
  //printing the list
  traverse() {
    let currentNode = this.head;
    while (currentNode) {
      console.log(currentNode.val);
      currentNode = currentNode.next;
    }
  }
  //finding if something exists in the list
  find(val) {
    let currentNode = this.head;
    while (currentNode) {
      if (currentNode.val === val) return true;
      currentNode = currentNode.next;
    }
    return false;
  }
  //adding things to list
  append(val) {
    const newNode = new Node(val);
    if (!this.head) {
      this.head = newNode;
      this.tail = newNode;
      return;
    }
    this.tail.next = new Node();
    this.tail = new Node();
  }
}

const history = new linkedList();
history.head = firstPage;
