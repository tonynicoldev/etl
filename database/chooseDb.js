
// This module uses the DB_TYPE env var to determine which database module to load
// The chosen database module is exported as db
const path = require('path');
const { DB_TYPE } = process.env;
const MYSQL_MODULE = path.resolve(__dirname, './mysql-database-fns');  // Paths go in code not config
const MONGO_MODULE = path.resolve(__dirname, './mongo-database-fns');
let db;

// Choose the DB technology
try {
  switch (DB_TYPE) {
    case 'MONGO': db = require(MONGO_MODULE); break;
    case 'MYSQL': db = require(MYSQL_MODULE); break;
    // case 'POSTGRES': db = require(MYSQL_MODULE); break;  // Easy to add another one
    default: throw new Error(`No valid database technology selected. DB_TYPE = ${DB_TYPE}`);
  }
}
catch (err) {
  console.log(`Error: ${err.message}`);
}

module.exports = db; // Export the module
