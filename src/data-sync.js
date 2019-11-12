import {
  getTxIdsByTag,
  getTxData,
  getBlockForTx,
  getChainInfo
} from "./util.js";
import flatten from "lodash/flatten";
import difference from "lodash/difference";
import debug from "debug";

const log = debug('ar-posts-by-tag:sync');

export async function syncIteration(existingBlocks, options) {
  const { height } = await getChainInfo();
  log(`executing syncIteration`)
  log(`chain height is ${height}`)

  let idsToRetrieve = [];

  if (existingBlocks.length === 0 || height > existingBlocks[0].height) {
    const existingTxIds = flatten(existingBlocks.map(block => block.txs));
    log(`existingTxIds: ${existingTxIds}`)
    const remoteTxIds = await getTxIdsByTag([`App-Name`, options.appName]);
    log(`remoteTxIds: ${remoteTxIds}`)

    const newTxIds = difference(remoteTxIds, existingTxIds);
    log(`newTxIds: ${newTxIds}`)

    idsToRetrieve = newTxIds;
  }

  const txDataPromises = idsToRetrieve.map(id => getTxData(id));
  const transactions = await Promise.all(txDataPromises);
  log(`fetched ${transactions.length} transactions`)

  // TODO this may fetch duplicate blocks
  const blockDataPromises = idsToRetrieve.map(id => getBlockForTx(id));
  const blocks = await Promise.all(blockDataPromises);
  log(`fetched ${blocks.length} blocks`)

  return { transactions, blocks: blocks };
}
