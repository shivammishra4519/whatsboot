const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config();

const url = process.env.MONGODB_URI;

let db = null;

async function connectToDB() {
  try {
    const client = new MongoClient(url, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      }
    });
    db = client.db('whatsapp-service');
    console.log('Connected to the database');
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    // Rethrow the error to propagate it
    throw error;
  }
}

function getDB() {
  if (!db) {
    throw new Error('Database connection has not been established.');
  }

  return db;
}

module.exports = {
  connectToDB,
  getDB
};



    