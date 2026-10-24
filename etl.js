const express = require('express');
const app = express();
const DEFAULT_PORT = 3000;

// Using this for running in vscode only.  Docker compose will load its own env vars to inject into containers
require('dotenv').config({ path: './dev_env_vars/.env.required' });  // Can use this instead of or as well as defaults
require('dotenv').config({ path: './dev_env_vars/.env' });

const quizRouter = require('./routers/quizRouter');
const PORT = process.env.APP_PORT || DEFAULT_PORT; // Use default but it can be overridden

// Routes
app.use('/', quizRouter);
app.use('/etl/:table/:filename', quizRouter);
app.use('/data/:table', quizRouter);

app.listen(PORT, () => console.log(`ETL application listening on port ${PORT}`));