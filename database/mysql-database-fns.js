const mysql = require('mysql2/promise');
const extractData = require('./extractData'); // Include the data parsing module
const HOST = process.env.MYSQL_HOST;          
const USER = process.env.MYSQL_USER;          
const MYSQL_PWD = process.env.MYSQL_PWD;   
const PORT = process.env.MYSQL_PORT || 3306;
const MYSQL_DATABASE = process.env.MYSQL_DATABASE;
let pool;  // File scope obj holding the connection pool

//----------------------------------------------------------------------------------------------------------------------
// createDatabase
//----------------------------------------------------------------------------------------------------------------------
// If a database needs creating, connect to mysql to create one. Do not provide a database name in the connection string
// as that database may not exist so will cause an error. Just connect to the server not a database. If database exists
// then do nothing otherwise create it. We can then connect to it later.
async function createDatabase(connectionObj) {
  try {
    // Check the sensitive stuff. Provide using .env or config tools or manually
    if (!process.env.MYSQL_HOST) throw new Error("*** MYSQL_HOST required ***");
    if (!process.env.MYSQL_USER) throw new Error("*** MYSQL_USER required ***");
    if (!process.env.MYSQL_PWD) throw new Error("*** MYSQL_PWD required ***");
    if (!process.env.MYSQL_DATABASE) throw new Error("*** MYSQL_DATABASE required ***");

    const connection = await mysql.createConnection(connectionObj); // Connect to server - no database specified

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.MYSQL_DATABASE}`); // Try to create one
    console.log(`"${MYSQL_DATABASE}" database created or exists.`); // Could query database name but create is success 
    connectionObj.database = MYSQL_DATABASE; // Can now add the database to the general connection object
    await connection.end(); // Only need this direct connection for DB creation so close it
  } catch (err) {
    throw err; // Rethrow up to caller
  }
}

//----------------------------------------------------------------------------------------------------------------------
// createConPool
//----------------------------------------------------------------------------------------------------------------------
// Create and initialise some connections
async function createConPool() {
  const connectionObj = {
    // Don't add database name here as createDatabase will add it when it's created one
    host: HOST,
    user: USER,
    password: MYSQL_PWD,
    port: PORT,

    // Add database specific config performance settings if you want to
    waitForConnections: true, // If all connections in use then queue & wait for one to be free rather than returning error
    connectionLimit: 10,      // Max concurrent connections
    queueLimit: 0             // Max queue length. Reject connections if more then this number. 0 means infinite queue
  }

  try {
    await createDatabase(connectionObj);    // Make sure there is a database to create a pool of connections for
    pool = mysql.createPool(connectionObj);
  } catch (err) {
    throw err; // rethrow up to caller
  }
}


//----------------------------------------------------------------------------------------------------------------------
// isConnected
//----------------------------------------------------------------------------------------------------------------------
// The pool creates connection objects but doesn't make a connection. If you want to connect to make sure the database 
// is there and to make the user feel better, execute a query on the database
// Queries returned from the database may be one or two arrays. For this query, if it fails, an array of two arrays
// is returned as normal but if it passes, it only returns one array with one element which is the database name
async function isConnected() {
  try {
    const result = await queryDatabase('SELECT DATABASE() AS CurrentDatabase');
    if (Array.isArray(result[1]) && result[0].length === 0) // More than one array as there is a second element
      return null;
    else
      return result[0].CurrentDatabase; // Must be a 1d array response with just the database name
  } catch (err) {
    if (pool) await pool.end(); // Close all pool connections and await until complete
    console.log(`isConnected function failed: ${err.message}`);
    throw err;
  }
}


//----------------------------------------------------------------------------------------------------------------------
// queryDatabase
//----------------------------------------------------------------------------------------------------------------------
// General purpose database query function. Pass in the query and any optional params
async function queryDatabase(query, params = []) {
  let connection;
  try {
    if (!pool) return []; // Pool not created
    connection = await pool.getConnection(); // Get a connection from the pool. Wait for it to return
    const [rows] = await connection.execute(query, params); // Execute the query. Deconstruct array to just get the rows
    return rows;
  } catch (err) {
    console.log(`Failed to get a database connection: ${err.message}`);
    throw err;
  } finally {
    if (connection) connection.release(); // Release the connection back to the pool regardless of success or failure
  }
}

//----------------------------------------------------------------------------------------------------------------------
// getAllData
//----------------------------------------------------------------------------------------------------------------------
// Get all data from the table and return to caller. To test the exception stack
// change * to *q to make it fail then trace the exception back to the source
async function getAllData(table) {
  let sql = `SELECT * FROM ${table}`;
  try {
    return await queryDatabase(sql);
  } catch (err) {
    console.log(`getDataFunction failed: ${err.message}`);
    throw err;
  }
}


//----------------------------------------------------------------------------------------------------------------------
// countRows
//----------------------------------------------------------------------------------------------------------------------
// Return number of rows in table
async function countRows(tableName) {
  const sql = `SELECT COUNT(*) FROM ${tableName};`
  const [result] = await queryDatabase(sql);
  return result['COUNT(*)']; // One of the few cases where can't use result. as the attribute is a string
}


//----------------------------------------------------------------------------------------------------------------------
// createTable
//----------------------------------------------------------------------------------------------------------------------
async function createTable(tableName) {
  // Recreate during testing. 
  const sql = 'CREATE TABLE ' + tableName + '(    \
  `id` INT NOT NULL AUTO_INCREMENT,               \
  `question` TEXT NOT NULL,                       \
  `answer` TEXT NOT NULL,                         \
  PRIMARY KEY (`id`),                             \
  UNIQUE INDEX `id_UNIQUE` (`id` ASC) VISIBLE);'
  try {
    return await queryDatabase(sql);
  } catch (err) {
    console.log(`createTable function failed ${err.message}`);
    throw err;
  }
}


//----------------------------------------------------------------------------------------------------------------------
// etl
//----------------------------------------------------------------------------------------------------------------------
// Note: this function looks for tabs between Q and A and CR for end of question
// so last question in the data file must end with a CR 
async function etl(tableName, filename) {
  let qArr, ansArr; // Need these in function scope
  try {
    [qArr, ansArr] = await extractData(filename); // Extract and transform data from text file
  } catch (err) {
    console.log(`extractData function failed: ${err.message}`);
    throw err;
  }
  // Iterate the returned Q&A arrays and load into the table
  let sql = `insert into ${tableName} (question, answer) values`;
  let i = 0;
  while (i < qArr.length - 1) {               // Treat last one differently
    sql += `('${qArr[i]}','${ansArr[i]}'),`;
    i++;
  }
  sql += `('${qArr[i]}','${ansArr[i]}');` // Don't want a comma on this one

  try {
    const result = await queryDatabase(sql);
    return result;
  } catch (err) {
    console.log(`queryDatabase failed with ${err.message}`);
    throw err;
  }
}

// Delete the named table
async function dropTable(tableName) {
  const sql = `DROP TABLE IF EXISTS ${tableName}`;
  try {
    await queryDatabase(sql);
  } catch (err) {
    console.log(`queryDatabase failed trying to drop table: ${err.message}`);
    throw err;
  }
}


//----------------------------------------------------------------------------------------------------------------------
// createConPool
//----------------------------------------------------------------------------------------------------------------------
// Run when the database code is loaded to initialise the database and connection pool
// Call isConnected() to report the connection status
// Used .then to show how to avoid async function wrapping
createConPool() // Create the connections pool - it also creates a database if needed
  .then(() => isConnected()) // Call isConnected if pool created, return dbName
  .then((dbName) => console.log(`"${dbName}" database is connected`))  // Resolved promise from isConnected passes returned value
  .catch(err => {
    console.log(`${err.message}. Connection failed so killing app.`); // Allows us to catch the top level exception and deal with it
    process.exit(1); // Failed so kill the app and let docker restart it if using containers - otherwise use retry code
  })



// Export functions that avoid the user needing to know the type of database
module.exports = {
  getAllData,
  countRows,
  createTable,
  etl,
  dropTable
}