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
    if(i === 0) {
      if(!(alphabet.includes(message[i]))){
        encryptedMessage += message[i];
      }
      else {
        encryptedMessage += encryptMessage(message[i], variableShift);
      }
    }

    else if(((i)+1) % 2 === 0 && (!(alphabet.includes(message[i])))) {
        encryptedMessage += message[i];
    }

    else if((!(alphabet.includes(message[i])) && (((i)+2) % 2) === 0) && (i !== 0)) {
      let ranChar =  Math.floor(Math.random() * alphabet.length);
      encryptedMessage += alphabet[ranChar];
      encryptedMessage += message[i];
    }

    else if(((i)+1) % 2 === 0 ) {
        encryptedMessage += decryptMessage(message[i], variableShift);
      }

    else if (((((i)+2) % 2) === 0) && (i !== 0)) {
      let ranChar =  Math.floor(Math.random() * alphabet.length);
      encryptedMessage += alphabet[ranChar];
      encryptedMessage += encryptMessage(message[i], variableShift);
    }

    else encryptedMessage += encryptMessage(message[i], variableShift);
  }
  return encryptedMessage;
}


function decrypt (encryptedMessage, variableShift)
{
  let decryptedMessage = "";

  for (let i=0; i < encryptedMessage.length; i++){
    if(i === 0) {
        if(!(alphabet.includes(encryptedMessage[i]))){
          decryptedMessage += encryptedMessage[i];
        }
        else {
          decryptedMessage += decryptMessage(encryptedMessage[i], variableShift);
        }
    }

    else if ((((((i+1) % 3) === 0 )))) {
      decryptedMessage += (encryptedMessage[i], "");
    }

    else if (!(alphabet.includes((encryptedMessage[i]).toLowerCase()))) {
      decryptedMessage += encryptedMessage[i];
    }

    else if((i+1) % 2 === 0 ) {
        decryptedMessage += encryptMessage(encryptedMessage[i], variableShift);
    }

    else decryptedMessage += decryptMessage(encryptedMessage[i], variableShift);
   
  }
  return decryptedMessage;
}

decrypt("invxcjz", "1")