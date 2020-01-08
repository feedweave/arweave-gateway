import pg from "pg";
import { decodeTags, ownerToAddress, base64Decode } from "./util.js";
const { Pool } = pg;

const pool = new Pool();

function processTransactionRows(rows) {
  return rows.map(row => {
    if (row.content) {
      row.content = base64Decode(row.content);
    }
    return row;
  });
}
export async function getExistingBlockHeight() {
  const result = await pool.query(
    "SELECT height FROM blocks ORDER BY height DESC LIMIT 1;"
  );
  const row = result.rows[0];
  return row && row.height;
}

export async function getExistingTxIds() {
  const result = await pool.query("SELECT id FROM transactions");
  return result.rows.map(({ id }) => id);
}

const transactionColumns = `"id", "blockHash", "ownerAddress", "appName", "tags", transactions."rawData"->'data' as content, transactions."rawData"->'reward' as fee`;

export async function getTransactionsByOptions({ appName, walletId, page }) {
  let whereClause = `"appName" = $1`;
  const values = [appName];

  if (walletId) {
    whereClause = whereClause + ` AND "ownerAddress" = $2`;
    values.push(walletId);
  }

  let text = `SELECT ${transactionColumns} FROM transactions INNER JOIN blocks on transactions."blockHash"=blocks.hash WHERE ${whereClause} ORDER BY height DESC`;

  const result = await pool.query({
    text,
    values
  });
  return processTransactionRows(result.rows);
}

export async function getTransactionsByWallet(wallet, options) {
  const { appName } = options;
  let text = `SELECT ${transactionColumns} FROM transactions WHERE "ownerAddress" = $1`;
  const values = [wallet];

  if (appName) {
    text = text + ` AND "appName" = $2`;
    values.push(appName);
  }
  const result = await pool.query({
    text,
    values
  });
  return result.rows;
}

export async function getTransactionsByWalletAndApp(wallet, appName) {
  const result = await pool.query({
    text: `SELECT ${transactionColumns} FROM transactions WHERE "ownerAddress" = $1 AND "appName" = $2`,
    values: [wallet, appName]
  });
  return result.rows;
}

export async function getTransactionWithContent(transactionId) {
  const result = await pool.query({
    text: `SELECT ${transactionColumns} FROM transactions WHERE "id" = $1`,
    values: [transactionId]
  });

  return processTransactionRows(result.rows)[0];
}

export async function getAppNames() {
  const result = await pool.query(
    `SELECT "appName" FROM transactions GROUP BY "appName"`
  );

  return result.rows.map(({ appName }) => appName);
}

async function getBlock(hash) {
  const result = await pool.query({
    text: `SELECT * FROM blocks WHERE hash = $1`,
    values: [hash]
  });
  return result.rows[0];
}

async function getTransaction(id) {
  const result = await pool.query({
    text: `SELECT * FROM transactions WHERE id = $1`,
    values: [id]
  });
  return result.rows[0];
}

export async function saveTransaction(transaction) {
  const { id, blockHash, owner } = transaction;

  const existingTransaction = await getTransaction(id);
  if (existingTransaction) {
    const updateQuery = {
      text: `UPDATE transactions SET "blockHash"=($1) WHERE id=($2) RETURNING *`,
      values: [blockHash, id]
    };
    const updateResult = await pool.query(updateQuery);
    return updateResult.rows[0];
  }

  const tags = decodeTags(transaction.tags);
  const appNameTag = tags.find(tag => tag.name === `App-Name`);
  const appName = appNameTag && appNameTag.value;
  const tagsAsJson = JSON.stringify(tags);
  const ownerAddress = await ownerToAddress(owner);
  const query = {
    text: `INSERT INTO transactions("id", "blockHash", "rawData", "ownerAddress", "tags", "appName") VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    values: [id, blockHash, transaction, ownerAddress, tagsAsJson, appName]
  };

  const result = await pool.query(query);
  return result.rows[0];
}

async function saveBlock(block) {
  const { indep_hash: hash, height, timestamp } = block;

  const existingBlock = await getBlock(hash);
  if (existingBlock) {
    return existingBlock;
  }

  const query = {
    text: `INSERT INTO blocks("hash", "height", "timestamp", "rawData") VALUES($1, $2, $3, $4) RETURNING *`,
    values: [hash, height, timestamp, block]
  };

  const result = await pool.query(query);
  return result.rows[0];
}

export async function saveTransactionsAndBlocks(transactions, blocks) {
  const blockPromises = blocks.map(block => saveBlock(block).catch(err => err));
  const allBlockPromises = await Promise.all(blockPromises);
  const savedBlocks = allBlockPromises.filter(
    result => !(result instanceof Error)
  );

  const transactionPromises = transactions.map(transaction =>
    saveTransaction(transaction).catch(err => err)
  );
  const allTransactionPromises = await Promise.all(transactionPromises);
  const savedTransactions = allTransactionPromises.filter(
    result => !(result instanceof Error)
  );

  return {
    transactions: savedTransactions,
    blocks: savedBlocks
  };
}

export async function saveFetchError(url, error) {
  const query = {
    text: `INSERT INTO errors("url", "error") VALUES($1, $2) RETURNING *`,
    values: [url, error]
  };
  const result = await pool.query(query);
  return result.rows;
}
