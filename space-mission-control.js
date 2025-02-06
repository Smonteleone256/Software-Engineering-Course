let oneTimeTasks = [];
let monitoringTaskId = [];
let monitoringTaskCount = 0;
let intervalId;
let countdownIntervalId;
let fuelRefillId;
let fuelLevel = 0;
let astronautCount = 4;
let launchPadPrepared = false;

function addOneTimeTask(func, delay) {
  let newTask = { function: func, delay: delay };
  oneTimeTasks.push(newTask);
}

function runOneTimeTasks() {
  for (i = 0; i < oneTimeTasks.length; i++) {
    duration = 20;
    setTimeout(oneTimeTasks[i].function, oneTimeTasks[i].delay);
  }
}

function startMonitoring() {
  if (!intervalId) {
    intervalId = setInterval(monitor, 3000);
    monitoringTaskId += intervalId;
  }
}

function monitor() {
  monitoringTaskCount++;
  console.log(`Check ${monitoringTaskCount}`);
}

function stopMonitoring() {
  clearInterval(monitoringTaskId);
  intervalId = null;
  console.log("Monitoring stopped");
}

function startCountdown() {
  console.log(`Countdown started: Liftoff T-minus 10 seconds`);
  duration = 10;

  if (!countdownIntervalId) {
    countdownIntervalId = setInterval(() => {
      if (duration === 0) {
        console.log("Liftoff!");
        clearInterval(countdownIntervalId);
        countdownIntervalId = null;
        return;
      } else {
        console.log(`Time remaining: ${duration} seconds`);
        duration--;
      }
    }, 1000);
  }
}

function fuelRefill() {
  if (fuelLevel === 0) {
    fuelLevelId = setInterval(() => {
      if (fuelLevel === 100) {
        console.log("Fuel Tank Full");
        clearInterval(fuelLevelId);
        fuelLevelId = null;
        return;
      } else {
        console.log(`Fuel Level: ${fuelLevel}%`);
        fuelLevel += 10;
      }
    }, 10);
  }
}

function astronautsPresent() {
  if (astronautCount === 4) {
    console.log(`Astronauts on board: ${astronautCount}, ready for boarding`);
    launchPadPrepared = true;
  } else {
    console.log("Not all crew accounted for, aborting mission");
    clearInterval(countdownIntervalId);
    stopMonitoring();
  }
}

function launchPadStatus() {
  if (launchPadPrepared) {
    console.log("Launch Pad Prepared");
    return;
  } else {
    console.log("Launch Pad not prepared, aborting mission");
    clearInterval(countdownIntervalId);
    stopMonitoring();
  }
}
function scheduleMission() {
  addOneTimeTask(startMonitoring, 0);
  addOneTimeTask(fuelRefill, 2000);
  addOneTimeTask(astronautsPresent, 5000);
  addOneTimeTask(launchPadStatus, 7000);
  addOneTimeTask(startCountdown, 13000);
  console.log(oneTimeTasks);
  runOneTimeTasks();
}

scheduleMission(); // Starts the mission.
