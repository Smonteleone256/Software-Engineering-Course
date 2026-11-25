function mysteryOperation() {
  const outcome = Math.random(); // Generates a random number between 0 and 1.

  if (outcome < 0.5) {
    console.log("The operation is completed successfully!");
  } else {
    throw new Error("The operation has failed mysteriously!");
  }
}

let vacationDays = 0;

for (let i = 0; i < 20; i++) {
  try {
    mysteryOperation();
    vacationDays += 13;
  } catch (error) {
    console.log("The operation has failed mysteriously!");
    vacationDays += 1;
  } finally {
    vacationDays += 3;
  }

  console.log(vacationDays);
}
