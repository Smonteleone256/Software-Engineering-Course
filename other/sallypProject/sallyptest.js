async function fetchDogBreeds() {
  const response = await fetch("https://dog.ceo/api/breeds/list/all");
  if (!response.ok) {
    console.error(`HTTP error! status: ${response.status}`);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  const breedsSelect = document.getElementById("detailPatientBreed");
  const objectLength = Object.keys(data.message).length;

  for (let i = 0; i < objectLength; i++) {
    const optionElement = document.createElement("option");
    let breed = Object.keys(data.message)[i];
    let subBreed = Object.values(data.message)[i];

    if (subBreed.length < 1) {
      optionElement.innerText = breed;
      breedsSelect.appendChild(optionElement);
    } else {
      for (let j = 0; j < subBreed.length; j++) {
        console.log("extras!");
        optionElement.innerText = breed + " " + subBreed[j];
        breedsSelect.appendChild(optionElement);
      }
    }
  }
  console.log(breedsSelect);
}

// async function fetchDogBreeds() {
//   const response = await fetch("https://dog.ceo/api/breeds/list/all");
//   if (!response.ok) {
//     console.error(`HTTP error! status: ${response.status}`);
//     throw new Error(`HTTP error! status: ${response.status}`);
//   }
//   const data = await response.json();
//   const breedsSelect = document.getElementById("detailPatientBreed");
//   const objectLength = Object.keys(data.message).length;
//   console.log(`Fetched ${objectLength} dog breeds.`);

//   for (let i = 0; i < objectLength; i++) {
//     const breed = Object.keys(data.message)[i];
//     const values = Object.values(data.message)[i] || [];
//     values.forEach((value) => {
//       const optionElement = document.createElement("option");
//       optionElement.value = breed;
//       optionElement.innerText = value;
//       breedsSelect.appendChild(optionElement);
//     });
//   }
// }

fetchDogBreeds();
