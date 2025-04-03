const now = new Date();
now.getHours();

async function loadConfig() {
  if (now.getHours() > 17 || now.getHours() < 6) {
    const theme = await import("./theme.mjs");
    theme.setDarkTheme();
    console.log("Dark Theme Set!");
  } else {
    const theme = await import("./theme.mjs");
    theme.setLightTheme();
    console.log("Light Theme Set!");
  }
}

loadConfig();
