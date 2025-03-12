//Constructor function
let Person = function (name, gender, birthYear) {
  this.name = name;
  this.gender = gender;
  this.birthYear = birthYear;
  //   this.calcAge = function () {
  //     let age = new Date().getFullYear() - this.birthYear;
  //     console.log(age);
  //   }; Replaced by prototype constructor
};

//Example of prototype inheritance
Person.prototype.calcAge = function () {
  let age = new Date().getFullYear() - this.birthYear;
  console.log(age);
};

//Create an object instance of Person using the constructor function
let john = new Person("John", "Male", 1990);
console.log(john);
john.calcAge();

//"new" Operator does 3 things: creates an empty object, makes sure "this" variable points to new object, and returns the object from the constructor

//When creating any Object, they inhherit prototypes from the object constructor
//To prove this, you can use "instanceOf" method to compate any created object to "Object" and it returns true
//This allows any created object to inherit all prototype properties default to JS

//JS Classes
//Classes can not be hoisted(needs to be declared before using), are first class citizens(functions behind the scenes), and are executed in strict mode
//There are two ways to create a class

//The first is class declaration

// class Person{
//     constructor(name, gender, birthYear) {
//         this.name = name;
//         this.gender = gender;
//         this.birthYear = birthYear;
//         }
//      calcAge() = function () {
//             let age = new Date().getFullYear() - this.birthYear;
//             console.log(age);
//      }
// }

// Above, adding an inherited method inside the class contructor, below adding it outside
// Person.prototype.greet = function () {
//     console.log("Good Morning " + this.name);
// }

// Here is the syntax to create an object from a class
// let john = new Person("John", "Male", 1990);

//The second is class expression
// let Person = class {

// }

//Objects have two properties, data and accessor properties
//Data properties are the parameters set for each object (like name and gender in previous examples)
//Getter and Setter are the two accessor properties
//Getter reads property values while setter sets property values, can set one or both
//Are useful when data is hidden, as normal Object properties are not accessible the traditional way
//Can also customize them to change what they return

let alex = {
  name: "Alex",
  birthYear: 1980,
  annualSalary: 3000000,

  get getName() {
    return "King " + this.name;
  },

  set setName(newName) {
    if (newName.length < 3) {
      console.error("Name must be at least 3 characters long");
      return;
    } else {
      this.name = newName;
    }
  },
};

console.log(alex.getName);
alex.setName = "Alex Rodriguez";
console.log(alex.getName);

let User = class {
  constructor(name, password, role) {
    this.name = name;
    this.password = password;
    this.role = role;
  }

  static greet() {
    console.log("Hey there!");
  }

  set setPassword(password) {
    if (password.length < 4) {
      console.log("Password must be at least 4 characters long");
    } else {
      this.password = password;
    }
  }
};

//^Static Methods are associated with classes and not instances
//When using a static method, we call it using the class name
//Won't appear in prototype inherited methods

User.greet();
Person.greet = function () {
  console.log("Hey there!");
};

//Object.create() - least used for prototypal inheritance

let person = {
  calcAge() {
    return new Date().getFullYear - this.birthYear;
  },

  greet() {
    console.log("Hey there!");
  },

  init(name, gender, birthYear) {
    this.name = name;
    this.gender = gender;
    this.birthYear = birthYear;
  },
};

let ron = Object.create(person);
//creates an object in person object constructor with no parameters
let sarah = Object.create(person, {
  name: { value: Sarah },
  gender: { value: Female },
  birthYear: { value: 1996 },
});
//same thing but with parameters
let casey = Object.create(person);
casey.init("Casey Monteleone", "Female", 1995);
//since it is inheriting functions from the constructor, it can use the init() fuction to insert values

//Function constructors can inherit from other function constructors
let Employee = function (name, gender, birthYear, employeeId, salary, company) {
  Person.call(this, name, gender, birthYear); //has the person constructor point to created object
  this.employeeId = employeeId;
  this.salary = salary;
  this.company = company;
};

Employee.prototype = Person.prototype; //Inherits any added methods, do this before you attach anything else to child constructor
Employee.prototype.calcSalary = function () {
  return this.salary * 12;
};
Employee.prototype.empDetails = function () {
  console.log(this.name);
  console.log(this.employeeId);
};

let mark = new Employee("Mark", "Male", 1985, 47956, 8000, "Banfield");
