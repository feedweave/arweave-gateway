import {
  getTxIdsByAppNames,
  getTxWithBlockHash,
  getBlockForTx,
  getChainInfo
} from "./util.js";
import difference from "lodash/difference";
import debug from "debug";

const log = debug("ar-tag-explorer:sync");

// TODO
// pass in `highestExistingBlock` and `existingTxIds` into `syncIteration`

export async function syncIteration(existingHeight, existingTxIds, options) {
  const { height } = await getChainInfo();
  log(`executing syncIteration`);
  log(`chain height is ${height}`);

  let idsToRetrieve = [];

  if (!existingHeight || height > existingHeight) {
    log(`existingTxIds: ${existingTxIds}`);
    const remoteTxIds = await getTxIdsByAppNames(options.appNames);
    log(`remoteTxIds: ${remoteTxIds}`);

    const newTxIds = difference(remoteTxIds, existingTxIds);
    log(`newTxIds: ${newTxIds}`);

    idsToRetrieve = newTxIds;
  }

  const txPromises = idsToRetrieve.map(id =>
    getTxWithBlockHash(id).catch(err => err)
  );
  const allTransactions = await Promise.all(txPromises);
  const transactions = allTransactions.filter(
    result => !(result instanceof Error)
  );

  log(`fetched ${transactions.length} transactions`);

  // TODO this may fetch duplicate blocks
  const blockDataPromises = idsToRetrieve.map(id =>
    getBlockForTx(id).catch(err => err)
  );
  const allBlocks = await Promise.all(blockDataPromises);
  const blocks = allBlocks.filter(result => !(result instanceof Error));
  log(`fetched ${blocks.length} blocks`);

  return { transactions, blocks: blocks };
}
