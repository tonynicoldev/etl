const mongoose = require('mongoose')
mongoose.pluralize(null) // Stop mongoose pluralising the collection names

const extractData = require('./extractData')

//DB=ATLAS booksDb
//CON_STR=mongodb+srv://tony:mongoatlas12@cluster0.cifvaru.mongodb.net/booksDb?retryWrites=true&w=majority

const MONGO_DB_NAME = process.env.MONGO_DATABASE;
const MONGO_HOST = process.env.MONGO_HOST;  // Local host just for dev. Use service name when etl is in a container
const MONGO_PORT = process.env.MONGO_PORT || 27017         // Assuming running in a container otherwise 27017

const trivSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  }
})

// Demo Atlas using cluster connection string
//const conStr = `mongodb+srv://tony:mongoatlas12@cluster0.cifvaru.mongodb.net/${MONGO_DB_NAME}`
const conStr = `mongodb://${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB_NAME}`

async function connectToMongoDB() {
  try {
    // Connect to MongoDB using Mongoose. Mongo has a long connection timeout (30s by default) so reduce that here if needed. Could add to config
    await mongoose.connect(conStr, {
      serverSelectionTimeoutMS: 2000, // 2 seconds
      connectTimeoutMS: 2000          // 2 seconds
    })
    const dbName = mongoose.connection.name
    return dbName
  } catch (err) {
    console.log(`connectToMongoDB failed: ${err.message}`)
    throw err // Throw to caller
  }
}

async function getData(collectionName) {
  // model - creates a javascript object we work with and Mongoose checks against the schema and reads / writes the collection mapping to document atttributes
  // const trivModel = mongoose.model('question', trivSchema) // Expects to find a collection called questions - i.e. plural
  const collection = mongoose.model(`${collectionName}`, trivSchema)
  try {
    const questions = await collection.find() // Get all of them
    if (questions.length == 0) throw ('Not found')
    else
      return questions
  } catch (err) {
    console.log(`getData failed: ${err.message}`)
    throw (err)
  }
}

// Called it dropTable to keep the function names the same. Could have called it deleteStore to be technology agnostic and applied to other functions
async function dropTable(collectionName) {
  try {
    const collection = mongoose.model(`${collectionName}`, trivSchema)
    let result = await collection.collection.drop()
    return false // as in no error
  } catch (err) {
    console.log(`dropTableFailed ${err.message}`)
    throw (err)
  }
}

// This is a function stub just to avoid changing the calling program
// It does nothing as there is no need to explicitly create a collection as one is
// created when data is saved to it if it doesn't exist
async function createTable(tableName) {
  return true
}

// Note: this function looks for tabs between Q and A and CR for end of question
// so last question in the data file must end with a CR 
async function etl(tableName, filename) {
  let qArr, ansArr // I need these in scope after the try

  try {
     [qArr, ansArr] = await extractData(filename)
  } catch (err) {
    console.log(`extractData failed in function etl: ${err.message}`)
    throw err
  }

  //  Create an array of objects to make up the mongo document then load into database
  let docArray = [] // Add all the q and a objects to the array
  let i = 0
  while (i < qArr.length) {
    let doc = {}
    doc.question = qArr[i]
    doc.answer = ansArr[i]
    docArray.push(doc)
    i++
  }

  try {
    const collection = mongoose.model(`${tableName}`, trivSchema)
    await collection.insertMany(docArray) // Insert the whole array
    return false // as in no error
  } catch (err) {
    throw (err)
  }
}



// Count the documents in the collection
async function countRows(collectionName) {
  try {
    const collection = mongoose.model(`${collectionName}`, trivSchema)
    return await collection.countDocuments() // Return the count
  } catch (err) {
    throw (err)
  }
}

// Connect and return database name
async function isConnected() {
  try {
    const dbname = await connectToMongoDB()
    return dbname
  } catch (err) {
    console.log(`connectToMongo failed in isConnected: ${err.message}`)
    throw err
  }
}

// Run this at startup to check if connected
isConnected()
  .then((dbName) => console.log(`"${dbName}" database is connected`))  // Resolved promise from isConnected passes returned value
  .catch(err => {
    console.log(`Connection failed so killing app`) // Allows us to catch the top level exception and deal with it
    process.exit(1) // Failed so kill the app and let docker restart it if using containers - otherwise use retry code
  })

// Make these functions available outside this module
module.exports = {
  getData,
  countRows,
  createTable,
  etl,
  dropTable,
  isConnected
}