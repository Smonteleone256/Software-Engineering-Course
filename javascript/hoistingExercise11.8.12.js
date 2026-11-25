console.log(timeMachineModel);

let destination = "Ancient Egypt";
console.log(destination);

destination = "Medieval Europe";
console.log(destination);

const travelDate = "2024-03-15";
//trying the following code:

//travelDate = "2024-2-28"

// yields a redeclaration error because "const was used"

var timeMachineModel = "T-800";
//the variable was hoisted to the top, hence "undefined" being returned
//as it was not declared till the end of the file
