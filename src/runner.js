import dotenv from "dotenv";
dotenv.config();
import debug from "debug";

import { syncIteration } from './data-sync.js'
import { getExistingBlocks, saveTransactionsAndBlocks } from "./data-db.js";

// connect to db
// load existingBlocks
// run syncIteration(existingBlocks, options)
// persist new blocks
// loop

const log = debug("ar-tag-explorer:runner");

export async function runner() {
  const existingBlocks = await getExistingBlocks();
  log(`existingBlocks: ${existingBlocks.map(block => block.hash)}`);

  const options = {
    appName: `scribe-alpha-00`
  };

  const syncResult = await syncIteration(existingBlocks, options);
  log(`syncedTransactions: ${syncResult.transactions}`);
  log(`syncedBlocks: ${syncResult.blocks}`);

  const savedResults = await saveTransactionsAndBlocks(syncResult.transactions, syncResult.blocks)
  log(`savedTransactions: ${savedResults.transactions}`);
  log(`savedBlocks: ${savedResults.blocks}`);
  // TODO push saved blocks into `existingBlocks`
  // TODO set up a loop
  // -- delay at the end of while loop
}

runner();
