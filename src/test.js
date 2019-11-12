import dotenv from 'dotenv'
import pg from 'pg'
const { Client } = pg
dotenv.config()

// import { syncIteration } from './data-sync.js'

async function runTest() {
  // const existingBlocks = []
  // const options = {
  //     appName: `scribe-alpha-00`
  // }
  // const result = await syncIteration(existingBlocks, options);
  const client = new Client();
  await client.connect();
  const res = await client.query("SELECT $1::text as message", [
    "Hello world!"
  ]);
  console.log(res.rows[0].message); // Hello world!
  await client.end();
}

runTest();
