const alphabet = "abcdefghijklmnopqrstuvwxyz";

function encryptLetter(letter, variableShift) {
  const fixedLetter = (letter.toLowerCase());

  const idx = alphabet.indexOf(fixedLetter);

  const shiftedIdx = (idx + parseInt(variableShift)) % alphabet.length;

  return alphabet[shiftedIdx];
}


function encryptMessage(message, variableShift) {
  let encryptedMessage = "";
  for (let i=0; i < message.length; i++) {
    encryptedMessage += encryptLetter(message[i], variableShift);
  }
  return encryptedMessage;
}


function decryptLetter(letter, variableShift) {
  const fixedLetter = (letter.toLowerCase());

  const idx = alphabet.indexOf(fixedLetter);

  const shiftedIdx = (((idx + alphabet.length) - (parseInt(variableShift)) % alphabet.length) % alphabet.length);

  return alphabet[shiftedIdx];

}


function decryptMessage(message, variableShift){
  let decryptedMessage = "";
  for (let i=0; i < message.length; i++) {
    decryptedMessage += decryptLetter(message[i], variableShift);
  }
  return decryptedMessage;
}


function encrypt (originalMessage, variableShift)
{
  let encryptedMessage = "";
  let message = (originalMessage.toLowerCase());

  for (let i=0; i < message.length; i++){
    if((!(alphabet.includes(message[i])) && (((i)+2) % 2) === 0) && (i !== 0)) {
      let ranChar =  Math.floor(Math.random() * alphabet.length);
      encryptedMessage += alphabet[ranChar];
      encryptedMessage += message[i];
    }

    else if (((((i)+2) % 2) === 0) && (i !== 0)) {
      let ranChar =  Math.floor(Math.random() * alphabet.length);
      encryptedMessage += alphabet[ranChar];
      encryptedMessage += encryptMessage(message[i], variableShift);
    }

    else if (!(alphabet.includes(message[i]))) {
      encryptedMessage += message[i];
    }

    else encryptedMessage += encryptMessage(message[i], variableShift);
  }
  return encryptedMessage;
}

//Helped with modulo calculations https://www.calculatorsoup.com/calculators/math/modulo-calculator.php
//Used this site a lot to check my code https://jshint.com/



function decrypt (encryptedMessage, variableShift)
{
  let decryptedMessage = "";

  for (let i=0; i < encryptedMessage.length; i++){
    if ((((((i+1) % 3) === 0 && (i !== 0))))) {
      decryptedMessage += (encryptedMessage[i], "");
    }

    else if (!(alphabet.includes((encryptedMessage[i]).toLowerCase()))) {
      decryptedMessage += encryptedMessage[i];
    }

    else decryptedMessage += decryptMessage(encryptedMessage[i], variableShift);
   
  }
  return decryptedMessage;
}

//Learned from this website how to delete specific string characters https://www.geeksforgeeks.org/how-to-remove-a-character-from-string-in-javascript/




