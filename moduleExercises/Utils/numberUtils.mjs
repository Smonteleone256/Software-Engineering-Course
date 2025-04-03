export { add, multiply };

function add(num, ...nums) {
  let sum = num;
  nums.forEach((nums) => (sum += nums));
  console.log(sum);
}

function multiply(num, ...nums) {
  let product = num;
  nums.forEach((nums) => (product *= nums));
  console.log(product);
}
