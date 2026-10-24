const express = require('express');
const router = express.Router();
const path = require('path'); 
const dataPath = path.resolve(__dirname, '../.data'); // Source of the tab delimited data files
const db = require(path.resolve(__dirname, '../database/chooseDb')); // The chosen db tech from chooseDb module

// **** Quiz routes ****

// Used to just check the app is alive
router.get('/', async (req, res) => {
  res.send('ETL Service is responding');
})


// This endpoint takes table and filename to ETL into. e.g. http://localhost:3000/etl/stuff/quiz.txt
// quiz.txt needs to be in the dataPath
// It deletes the table if it exists to start from scratch. Creates a new one and ETL quiz Q&A into it
router.get('/etl/:table/:filename', async (req, res) => {
  try {
    console.log(`About to drop table ${req.params.table}`);
    await db.dropTable(req.params.table);   // Start from scratch for the demo

    console.log(`About to create table ${req.params.table}`);
    await db.createTable(req.params.table);

    console.log(`About to etl table ${dataPath + '/' + req.params.filename}`);
    await db.etl(req.params.table, dataPath + '/' + req.params.filename);

    const result = await db.countRows(req.params.table);
    console.log(`Added ${result} rows.`);
    
    res.send(`Added ${result} rows.`);
  } catch (err) {
    console.log('GET /etl/:table/:filename failed with error:', err.message);
    res.send(`Failed: ${err.message}`); // Just report the problem
  }
})

// Return all data from the table. 
router.get('/data/:table', async (req, res) => {
  try {
    response = await db.getAllData(req.params.table);
    res.send(response);
  } catch (err) {
    res.status(500).send(err); // Server error
  }
})

module.exports = router;