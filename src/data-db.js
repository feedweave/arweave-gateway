import pg from "pg";
const { Pool } = pg;

const pool = new Pool();

export async function getExistingBlocks() {
  const result = await pool.query("SELECT * FROM blocks ORDER BY height DESC");
  return result.rows;
}

async function saveTransaction(transaction) {
  const { id, blockHash, owner } = transaction;
  const query = {
    text: `INSERT INTO transactions("id", "blockHash", "rawData", "owner") VALUES($1, $2, $3, $4)`,
    values: [id, blockHash, transaction, owner]
  };

  const result = await pool.query(query);
  return result.rows[0];
}

async function saveBlock(block) {
  const { indep_hash, height, timestamp } = block;
  const query = {
    text: `INSERT INTO blocks("hash", "height", "timestamp", "rawData") VALUES($1, $2, $3, $4)`,
    values: [indep_hash, height, timestamp, block]
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

// TODO tags
// persist tags in tags table
// tags have id and name
// join table between tag and id

// TODO query database:
// posts by tag (after/before block height)
// posts by public key
