function post(title, content) {
  this.title = title;
  this.content = content;
  function publish() {
    console.log(`${this.title}`);
    console.log(`${this.content}`);
  }
}
