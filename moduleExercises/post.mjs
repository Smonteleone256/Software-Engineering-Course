export default function post(title, content) {
  this.title = title;
  this.content = content;

  this.publish = function () {
    console.log(`${this.title}`);
    console.log(`${this.content}`);
  };
}
