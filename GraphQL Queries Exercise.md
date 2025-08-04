**Basic Tasks**



1\.

{

&nbsp; allFilms {

&nbsp;   films{

&nbsp;     title

&nbsp;   }

&nbsp; }

}



2\.

query MyQuery {

&nbsp; person (id: "cGVvcGxlOjQ=") {

&nbsp;   name

&nbsp; }

}



3\.

query MyQuery {

&nbsp; allPlanets(first: 5) {

&nbsp;   edges {

&nbsp;     node {

&nbsp;       name

&nbsp;     }

&nbsp;   }

&nbsp; }

}



4\.

query MyQuery {

&nbsp; allStarships(first: 3) {

&nbsp;   starships {

&nbsp;     name

&nbsp;     model

&nbsp;   }

&nbsp; }

}



**Intermediate Tasks**



1\.

query MyQuery {

&nbsp; allPeople(first: 5) {

&nbsp;   edges {

&nbsp;     node {

&nbsp;       name

&nbsp;       starshipConnection {

&nbsp;         starships {

&nbsp;           name

&nbsp;         }

&nbsp;       }

&nbsp;     }

&nbsp;   }

&nbsp; }

}



2\.

query MyQuery {

&nbsp; allSpecies(last: 5) {

&nbsp;   species {

&nbsp;     name

&nbsp;     language

&nbsp;   }

&nbsp; }

}



3\.

query MyQuery {

&nbsp; allPlanets(last: 5) {

&nbsp;   planets {

&nbsp;     climates

&nbsp;     name

&nbsp;   }

&nbsp; }

}



4\.

query MyQuery {

&nbsp; allVehicles(first: 3) {

&nbsp;   vehicles {

&nbsp;     name

&nbsp;     costInCredits

&nbsp;   }

&nbsp; }

}



**Advanced Tasks**



1\.

\*\*\*query MyQuery {

&nbsp; allPeople {

&nbsp;   people {

&nbsp;     filmConnection {

&nbsp;       films {

&nbsp;         title

&nbsp;         characterConnection {

&nbsp;           characters {

&nbsp;             id

&nbsp;	      name

&nbsp;           }

&nbsp;         }

&nbsp;       }

&nbsp;     }

&nbsp;   }

&nbsp; }

}



2\.

query MyQuery {

&nbsp; allPeople {

&nbsp;   people {

&nbsp;     name

&nbsp;     filmConnection {

&nbsp;       totalCount

&nbsp;     }

&nbsp;   }

&nbsp; }

}



3\.

query MyQuery {

&nbsp; allPeople {

&nbsp;   totalCount

&nbsp; }

}



**Complex Tasks**



1\.

query MyQuery {

&nbsp; person(id: "cGVvcGxlOjQ=") {

&nbsp;   name

&nbsp;   starshipConnection {

&nbsp;     starships {

&nbsp;       name

&nbsp;     }

&nbsp;   }

&nbsp;   homeworld {

&nbsp;     name

&nbsp;   }

&nbsp;   filmConnection {

&nbsp;     films {

&nbsp;       title

&nbsp;     }

&nbsp;   }

&nbsp;   birthYear

&nbsp;   gender

&nbsp;   hairColor

&nbsp;   height

&nbsp; }

}



2\.

query MyQuery {

&nbsp; allPeople(first: 5) {

&nbsp;   totalCount

&nbsp;   people {

&nbsp;     name

&nbsp;     homeworld {

&nbsp;       name

&nbsp;       population

&nbsp;     }

&nbsp;   }

&nbsp; }

}



3\.

query MyQuery {

&nbsp; allVehicles(first: 3) {

&nbsp;   vehicles {

&nbsp;     name

&nbsp;     pilotConnection {

&nbsp;       pilots {

&nbsp;         name

&nbsp;         species {

&nbsp;           name

&nbsp;         }

&nbsp;       }

&nbsp;     }

&nbsp;   }

&nbsp; }

}



4\.

query MyQuery {

&nbsp; allFilms(first: 3) {

&nbsp;   films {

&nbsp;     title

&nbsp;     starshipConnection {

&nbsp;       starships {

&nbsp;         name

&nbsp;       }

&nbsp;     }

&nbsp;     planetConnection {

&nbsp;       planets {

&nbsp;         name

&nbsp;       }

&nbsp;     }

&nbsp;     characterConnection {

&nbsp;       characters {

&nbsp;         name

&nbsp;       }

&nbsp;     }

&nbsp;   }

&nbsp; }

}





