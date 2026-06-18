#!/usr/bin/env node
import mongoose from 'mongoose';

const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/tournament';

async function main() {
  await mongoose.connect(mongoUri);
  const dbName = mongoose.connection.db.databaseName;
  console.log(`Dropping database ${dbName}...`);
  await mongoose.connection.db.dropDatabase();
  console.log('Dropped.');
  await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
