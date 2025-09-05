const mysql = require('mysql2/promise');
const moment = require('moment-timezone');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'closrtech',
  port: process.env.DB_PORT || 3306
};

let db;

async function initDB() {
  try {
    db = await mysql.createConnection(dbConfig);
    console.log('Connected to MySQL database');
    return db;
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call initDB() first.');
  }
  return db;
}

function formatDateTime(date) {
  if (!date) return null;
  return moment(date).tz('America/New_York').format('YYYY-MM-DD h:mm A z');
}

function parseStates(statesInput) {
  return statesInput
    .split(',')
    .map(s => s.trim().toUpperCase())
    .filter(s => s.length === 2)
    .filter((value, index, self) => self.indexOf(value) === index);
}

function parseThresholds(thresholdsInput) {
  const thresholds = {};
  if (!thresholdsInput) return thresholds;
  
  thresholdsInput.split(',').forEach(item => {
    const [state, threshold] = item.split('=');
    if (state && threshold) {
      thresholds[state.trim().toUpperCase()] = parseInt(threshold.trim());
    }
  });
  
  return thresholds;
}

function sendPlainTextResponse(res, success, message) {
  const prefix = success ? 'SUCCESS' : 'ERROR';
  res.set('Content-Type', 'text/plain');
  res.send(`${prefix}: ${message}`);
}

module.exports = {
  initDB,
  getDB,
  formatDateTime,
  parseStates,
  parseThresholds,
  sendPlainTextResponse
};
