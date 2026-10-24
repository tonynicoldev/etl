const { MongoClient } = require('mongodb');
const extractData = require('./extractData');
const MONGO_DB_NAME = process.env.MONGO_DB_NAME;
const MONGO_HOST = process.env.MONGO_HOST;
const MONGO_PORT = process.env.MONGO_PORT || 27017;
const MONGO_SVR_SELECT_TIMEOUT = process.env.MONGO_SVR_SELECT_TIMEOUT; // cut from 30s default for dev
const MONGO_CONN_TIMEOUT = process.env.MONGO_CONN_TIMEOUT;             // cut from 30s default for dev
let client;
let db;
let conStr;

try {
  // Check the sensitive stuff. Provide using .env or config tools or manually
  if (!process.env.MONGO_HOST) throw new Error("*** MONGO_HOST required ***");
  if (!process.env.MONGO_DB_NAME) throw new Error("*** MONGO_DB_NAME required ***");

  conStr = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB_NAME}`;
} catch (err) {
  console.log(`Can't create the connection string. ${err.message}. App will be terminated.`);
  process.exit(1); // Kill the app as no point in carrying on
}



// -------------------------
// Connect to Mongo database
// -------------------------
async function connectToMongoDB() {
  try {
    client = new MongoClient(conStr, {
      serverSelectionTimeoutMS: MONGO_SVR_SELECT_TIMEOUT,
      connectTimeoutMS: MONGO_CONN_TIMEOUT,
    }); // Creates a connection pool and other stuff

    await client.connect(); // Create the TCP connection
    db = client.db(MONGO_DB_NAME); // Return the database object to be able to interact with it

    return db.databaseName; // To check it is up, ask it it's name and return the result
  } catch (err) {
    console.log(`connectToMongoDB failed: ${err.message}`);
    throw err;
  }
}

// ----------------------
// Get all documents
// ----------------------
async function getAllData(collectionName) {
  try {
    const collection = db.collection(collectionName); // Get a collection object

    // Find returns a cursor (pointer) to the docs. toArray iterates from the cursor and retrieves the data
    const docs = await collection.find().toArray();

    if (docs.length === 0) throw new Error('Not found');
    return docs;
  } catch (err) {
    console.log(`getData failed: ${err.message}`);
    throw err;
  }
}

// ----------------------
// Drop a collection
// ----------------------
async function dropTable(collectionName) {
  try {
    const collection = db.collection(collectionName);
    await collection.drop();
  } catch (err) {
    console.log(`dropTable failed: ${err.message}`);
    throw err;
  }
}

// --------------------------------------------------------------------------------------------
// No-op for MongoDB. 
// Table is created automatically so this is here just for compatibility across database calls
// --------------------------------------------------------------------------------------------
async function createTable(tableName) {
  return true; // Just say it's done it
}

// ----------------------
// ETL: load quiz data
// ----------------------
async function etl(tableName, filename) {
  let qArr, ansArr;

  try {
    [qArr, ansArr] = await extractData(filename); // Function in the parser module. Return Q array and Ans array 
  } catch (err) {
    console.log(`extractData failed in etl: ${err.message}`);
    throw err;
  }

  // Combine into a set of question and answer objects in a single array
  const docArray = qArr.map((q, i) => ({
    question: q,
    answer: ansArr[i]
  }));

  try {
    const collection = db.collection(tableName);
    await collection.insertMany(docArray); // Add all the questions into the collection as documents
  } catch (err) {
    console.log(`etl failed: ${err.message}`);
    throw err;
  }
}

// ----------------------
// Count documents
// ----------------------
async function countRows(collectionName) {
  try {
    const collection = db.collection(collectionName);
    return await collection.countDocuments();
  } catch (err) {
    console.log(`countRows failed: ${err.message}`);
    throw err;
  }
}

// ----------------------
// Check connection
// ----------------------
async function isConnected() {
  try {
    const dbName = await connectToMongoDB();
    return dbName;
  } catch (err) {
    console.log(`connectToMongo failed in isConnected(): ${err.message}`);
    throw err;
  }
}

// -------------------------------------------------------------------------
// Startup check
// Call is connected and if dbName is returned then say connected to dbName
// else report error and die
// -------------------------------------------------------------------------
isConnected()
  .then(dbName => console.log(`"${dbName}" database is connected`))
  .catch(err => {
    console.log(`Connection failed so killing app`);
    process.exit(1);
  });

// ----------------------
// Export functions
// ----------------------
module.exports = {
  getAllData,
  countRows,
  createTable,
  etl,
  dropTable,
};
