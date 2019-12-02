import dotenv from "dotenv";
dotenv.config();
import debug from "debug";

import { syncIteration } from "./data-sync.js";
import {
  getExistingBlockHeight,
  saveTransactionsAndBlocks,
  getExistingTxIds
} from "./data-db.js";
import { callDeployWebhook } from "./util.js";

const log = debug("ar-tag-explorer:runner");

let isShuttingDown = false;

const randomDelayBetween = (minSeconds, maxSeconds) => {
  const randomDelay = Math.random() * (maxSeconds - minSeconds);
  const ms = (minSeconds + randomDelay) * 1000;
  return new Promise(res => setTimeout(res, ms));
};

export async function runner(options) {
  let existingBlockHeight = await getExistingBlockHeight();
  log(`existingBlockHeight: ${existingBlockHeight}`);
  const existingTxIds = await getExistingTxIds();

  while (!isShuttingDown) {
    try {
      const syncResult = await syncIteration(
        existingBlockHeight,
        existingTxIds,
        options
      );
      log(`syncedTransactions: ${syncResult.transactions}`);
      log(`syncedBlocks: ${syncResult.blocks}`);

      const {
        transactions: savedTransactions,
        blocks: savedBlocks
      } = await saveTransactionsAndBlocks(
        syncResult.transactions,
        syncResult.blocks
      );

      log(`savedTransactions: ${savedTransactions}`);
      log(`savedBlocks: ${savedBlocks}`);

      if (savedTransactions.length > 0) {
        log(`calling deploy webhook`);
        await callDeployWebhook();
      }

      const newBlockHeight = savedBlocks.sort((a, b) => b.height - a.height);
      existingBlockHeight = newBlockHeight;

      existingTxIds.push(...savedTransactions.map(({ id }) => id));
    } catch (error) {
      log(`runner error: ${error}`);
    }

    await randomDelayBetween(10, 20);
  }
}

// TODO allow configuring with multiple appNames

const options = {
  appNames: [
    `arweave-blog-0.0.1`,
    `ArBoard`,
    `arweave-id`,
    `Academic`,
    `scribe-alpha-00`,
    `permamail`
  ]
};

runner(options);
