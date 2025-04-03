export { addString, reverseString };

function addString(a, b) {
  if (typeof a && typeof b === "string") {
    console.log(a + b);
  } else {
    throw new Error("Both inputs must be strings");
  }
}

function reverseString(string) {
  let newString = string.split("").reverse().join("");
  console.log(newString);
}
