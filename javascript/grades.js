let grades = [99, 98, 76, 54, 66, 90, 81];
let sum = 0;
debugger;

for (let i = 0; i <= grades.length; i++) {
  sum += grades[i];
}

let average = sum / grades.length;

console.log("Average Grade:", average);
