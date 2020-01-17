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
  while (!isShuttingDown) {
    try {
      const existingBlockHeight = await getExistingBlockHeight();
      log(`existingBlockHeight: ${existingBlockHeight}`);
      const existingTxIds = await getExistingTxIds();

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
    } catch (error) {
      log(`runner error: ${error}`);
    }

    await randomDelayBetween(10, 20);
  }
}

const options = {
  // eslint-disable-next-line no-undef
  appNames: process.env.APP_NAMES.split(",")
};

runner(options);
