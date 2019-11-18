import dotenv from "dotenv";
dotenv.config();
import debug from "debug";

import { syncIteration } from "./data-sync.js";
import { getExistingBlocks, saveTransactionsAndBlocks } from "./data-db.js";

const log = debug("ar-tag-explorer:runner");

let isShuttingDown = false;

const randomDelayBetween = (minSeconds, maxSeconds) => {
  const randomDelay = Math.random() * (maxSeconds - minSeconds);
  const ms = (minSeconds + randomDelay) * 1000;
  return new Promise(res => setTimeout(res, ms));
};

export async function runner(options) {
  const existingBlocks = await getExistingBlocks();
  log(`existingBlocks: ${existingBlocks.map(block => block.hash)}`);

  while (!isShuttingDown) {
    const syncResult = await syncIteration(existingBlocks, options);
    log(`syncedTransactions: ${syncResult.transactions}`);
    log(`syncedBlocks: ${syncResult.blocks}`);

    const savedResults = await saveTransactionsAndBlocks(
      syncResult.transactions,
      syncResult.blocks
    );
    log(`savedTransactions: ${savedResults.transactions}`);
    log(`savedBlocks: ${savedResults.blocks}`);

    existingBlocks.push(...savedResults.blocks);
    await randomDelayBetween(10, 20);
  }
}

// TODO allow configuring with multiple appNames

const options = {
  appName: `arweave-blog-0.0.1`
};

runner(options);
