document.addEventListener("DOMContentLoaded", function () {
  const noteContainer = document.getElementById("note-container");
  const newNoteButton = document.getElementById("new-note-button");
  const colorForm = document.getElementById("color-form");
  const colorInput = document.getElementById("color-input");

  if (!localStorage.getItem("Current ID Counter")) {
    localStorage.setItem("Current ID Counter", 0);
  }

  let noteColor = localStorage.getItem("Note Color");
  let noteIdCounter = localStorage.getItem("Current ID Counter");

  for (let i = 0; i < noteIdCounter; i++) {
    if (localStorage.getItem(`Saved Note ${i}`)) {
      const savedNote = localStorage.getItem(`Saved Note ${i}`);
      showSavedNote(i, savedNote);
    }
  }

  function addNewNote() {
    const id = noteIdCounter;
    const content = `Note ${id}`;

    const note = document.createElement("textarea");
    note.setAttribute("data-note-id", id.toString());
    note.value = content;
    note.className = "note";
    note.style.backgroundColor = noteColor;
    noteContainer.appendChild(note);

    localStorage.setItem(`Saved Note ${id}`, note.value);

    noteIdCounter++;
    localStorage.setItem("Current ID Counter", noteIdCounter);
  }
  function showSavedNote(id, value) {
    const note = document.createElement("textarea");
    note.setAttribute("data-note-id", id.toString());
    note.value = value;
    note.className = "note";
    note.style.backgroundColor = noteColor;
    noteContainer.appendChild(note);
  }

  colorForm.addEventListener("submit", function (event) {
    event.preventDefault();

    const newColor = colorInput.value.trim();

    const notes = document.querySelectorAll(".note");
    for (const note of notes) {
      note.style.backgroundColor = newColor;
    }

    colorInput.value = "";

    noteColor = newColor;

    localStorage.setItem("Note Color", newColor);
  });

  newNoteButton.addEventListener("click", function () {
    addNewNote();
  });

  document.addEventListener("dblclick", function (event) {
    if (event.target.classList.contains("note")) {
      event.target.remove();
      localStorage.removeItem(`Saved Note ${event.target.dataset.noteId}`);
    }
  });

  noteContainer.addEventListener(
    "blur",
    function (event) {
      if (event.target.classList.contains("note")) {
        const noteValue = event.target.value;
        localStorage.setItem(
          `Saved Note ${event.target.dataset.noteId}`,
          noteValue
        );
      }
    },
    true
  );

  window.addEventListener("keydown", function (event) {
    if (event.target.id === "color-input" || event.target.type === "textarea") {
      return;
    }

    if (event.key === "n" || event.key === "N") {
      addNewNote();
    }
  });
});
