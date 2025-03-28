function add(num, ...nums) {
  let sum = num;
  nums.forEach((nums) => (sum += nums));
  return sum;
}

function multiply(num, ...nums) {
  let product = num;
  nums.forEach((nums) => (product *= nums));
  return product;
}
