// Write a getCard() function which returns a random playing card object, like:
// 		{
// 			value: 'K'
// 			suit: 'clubs'
// 		}
//Pick a random value from:
//----2,3,4,5,6,7,8,9,10,J,Q,K,A
//Pick a random suit from:
//----clubs,spades, hearts, diamonds
//Return both in an object




// function getCard(){
//     const values = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
//     Math.floor(Math.random() * values.length);
//     const value = values[idx];

//     const suits = ["clubs", "diamonds", "spades", "hearts"];
//     const suitIdx = Math.floor(Math.random() * suits.length);
//     const suit = suits[suitIdx];
//     return {value: value, suit: suit};
// }


function pick(arr){
    const idx = Math.floor(Math.random() * arr.length);
    return arr[idx];
}

function getCard(){
    const values = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
    const suits = ["clubs", "diamonds", "spades", "hearts"];
    return { value: pick(values), suit: pick(suits)};
}