// db.js — single shared MongoDB connection (official driver, no Mongoose)
require('dotenv').config();
// Use public DNS for the mongodb+srv lookup — some networks (college Wi-Fi, Windows)
// refuse SRV queries, which causes "querySrv ECONNREFUSED".
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const { MongoClient, ObjectId } = require('mongodb');

let client;
let db;
let memoryServer;

function isAtlasConfigured() {
  const uri = process.env.MONGODB_URI;
  return uri && !uri.includes('<user>') && !uri.includes('<password>') && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'));
}

async function connect() {
  let uri = process.env.MONGODB_URI;
  let isMemory = false;

  if (!isAtlasConfigured()) {
    console.log('No valid MongoDB Atlas connection string found in .env.');
    console.log('Starting in-memory MongoDB instance (mongodb-memory-server)...');
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    isMemory = true;
  }

  client = new MongoClient(uri);
  await client.connect();
  db = client.db(process.env.DB_NAME || 'torquebase');
  await createIndexes(db);
  console.log('Connected to MongoDB:', isMemory ? `In-Memory Server (${uri})` : db.databaseName);

  if (isMemory) {
    const studentCount = await db.collection('students').countDocuments();
    if (studentCount === 0) {
      console.log('Seeding in-memory database with sample data...');
      const { seedData } = require('./seed');
      await seedData(db);
    }
  }

  return db;
}

// INDEXES — single-field, unique, compound
// TEXT INDEX — used by $text search on assets
async function createIndexes(db) {
  await db.collection('students').createIndex({ regNo: 1 }, { unique: true });          // unique
  await db.collection('students').createIndex({ subTeam: 1 });                          // single-field
  await db.collection('assets').createIndex({ category: 1, status: 1 });                // compound
  await db.collection('assets').createIndex({ vehicleId: 1 });                          // single-field (ref lookups)
  await db.collection('assets').createIndex(
    { name: 'text', description: 'text' },                                              // text index
    { name: 'asset_text_idx' }
  );
  await db.collection('maintenance').createIndex({ assetId: 1, date: -1 });             // compound
  await db.collection('inventory').createIndex({ item: 1 }, { unique: true });          // unique
}

const getDb = () => db;
const col = (name) => db.collection(name);

// Convert a string to ObjectId (returns null if invalid / empty)
const oid = (id) => (id && ObjectId.isValid(id) ? new ObjectId(id) : null);

// Send a 400 with the validation errors from rules.js (server-side re-check of the user-defined rules)
// Returns true if the request was rejected.
function reject(res, errors) {
  const msgs = Object.values(errors || {}).filter(Boolean);
  if (!msgs.length) return false;
  res.status(400).json({ error: msgs[0], fields: errors });
  return true;
}

async function close() {
  if (client) await client.close();
  if (memoryServer) await memoryServer.stop();
}

module.exports = {
  connect,
  close,
  getDb,
  col,
  oid,
  get client() { return client; },
  createIndexes,
  reject,
  getMemoryServer: () => memoryServer
};
