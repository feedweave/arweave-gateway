import {
  getTxIdsByAppNames,
  getTxWithBlockHash,
  getBlockForTx,
  getChainInfo
} from "./util.js";
import flatten from "lodash/flatten";
import difference from "lodash/difference";
import debug from "debug";

const log = debug("ar-tag-explorer:sync");

// TODO
// pass in `highestExistingBlock` and `existingTxIds` into `syncIteration`

export async function syncIteration(existingBlocks, options) {
  const { height } = await getChainInfo();
  log(`executing syncIteration`);
  log(`chain height is ${height}`);

  let idsToRetrieve = [];

  if (existingBlocks.length === 0 || height > existingBlocks[0].height) {
    const existingTxIds = flatten(
      existingBlocks.map(block => block.rawData.txs)
    );
    log(`existingTxIds: ${existingTxIds}`);
    const remoteTxIds = await getTxIdsByAppNames(options.appNames);
    log(`remoteTxIds: ${remoteTxIds}`);

    const newTxIds = difference(remoteTxIds, existingTxIds);
    log(`newTxIds: ${newTxIds}`);

    idsToRetrieve = newTxIds;
  }

  const txPromises = idsToRetrieve.map(id => getTxWithBlockHash(id));
  const transactions = await Promise.all(txPromises);
  log(`fetched ${transactions.length} transactions`);

  // TODO this may fetch duplicate blocks
  const blockDataPromises = idsToRetrieve.map(id => getBlockForTx(id));
  const blocks = await Promise.all(blockDataPromises);
  log(`fetched ${blocks.length} blocks`);

  return { transactions, blocks: blocks };
}
