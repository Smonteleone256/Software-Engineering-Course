const users = [
  { firstName: "Alice", lastName: "Johnson", points: 120 },
  { firstName: "Bob", lastName: "Smith", points: 99 },
  { firstName: "Charlie", lastName: "Brown", points: 180 },
];

users.map(function (array) {
  fullName = array.firstName + " " + array.lastName;
  if (array.points > 100) {
    membershipStatus = "Premium";
    return { fullName, membershipStatus };
  } else if (array.points <= 100) {
    membershipStatus = "Standard";
    return { fullName, membershipStatus };
  }
});
