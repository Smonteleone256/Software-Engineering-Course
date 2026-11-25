//Bubble Sort O(n^2), but works well if nearly sorted
//Other quadratic sorts, instertion and selection
function bubbleSort(arr) {
  let count = 0;
  for (let i = 0; i < arr.length; i++) {
    let swap = false;
    for (let j = 0; j < arr.length - i; j++) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
        swap = true;
      }
      if (!swap) break;
    }
    console.log("Total Count:", count);
    return arr;
  }
}

//Merge Sort, first need the merging helper function
function merge(arr1, arr2) {
  const results = [];
  let i = 0;
  let j = 0;

  while (i < arr1.length && j < arr2.length) {
    if (arr1[i] < arr2[j]) {
      results.push(arr1[i]);
      i++;
    } else {
      results.push(arr2[j]);
      j++;
    }
  }
  while (i < arr1.length) {
    results.push(arr1[i]);
    i++;
  }
  while (j < arr2.length) {
    results.push(arr2[j]);
    j++;
  }
  return results;
}
//and here is the actual sorting function
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  return merge(left, right);
}

//Best case for comparative functions are O(n log())
//Sorting in JS: use .sort() method
//JS is lexicographic, not numeric, by default
//Write comparator function to sort numerically: numbers.sort((a, b) => a - b)
