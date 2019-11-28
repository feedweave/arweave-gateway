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
export async function getExistingBlocks() {
  const result = await pool.query("SELECT * FROM blocks ORDER BY height DESC");
  return result.rows;
}

const transactionColumns = `"id", "blockHash", "ownerAddress", "appName", "tags", "rawData"->'data' as content`;

export async function getTransactionsByAppName(appName) {
  const result = await pool.query({
    text: `SELECT ${transactionColumns} FROM transactions WHERE "appName" = $1`,
    values: [appName]
  });
  return processTransactionRows(result.rows);
}

export async function getTransactionsByWallet(wallet) {
  const result = await pool.query({
    text: `SELECT ${transactionColumns} FROM transactions WHERE "ownerAddress" = $1`,
    values: [wallet]
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

export async function getTransactionContent(transactionId) {
  const result = await pool.query({
    text: `SELECT "rawData"->'data' as content FROM transactions WHERE "id" = $1`,
    values: [transactionId]
  });

  const row = result.rows[0];

  if (row) {
    return base64Decode(row.content);
  } else {
    return undefined;
  }
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
  const blockPromises = blocks.map(block => saveBlock(block));
  const savedBlocks = await Promise.all(blockPromises);

  const transactionPromises = transactions.map(transaction =>
    saveTransaction(transaction)
  );
  const savedTransactions = await Promise.all(transactionPromises);

  return {
    transactions: savedTransactions,
    blocks: savedBlocks
  };
}
