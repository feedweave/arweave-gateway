import pg from "pg";
import groupBy from "lodash/groupBy";
import compact from "lodash/compact";
import {
  decodeTags,
  ownerToAddress,
  base64Decode,
  base64Encode
} from "./util.js";
const { Pool } = pg;

const pool = new Pool();

function processTransactionRows(rows) {
  return rows.map(row => {
    if (row.content) {
      row.content = base64Decode(row.content);
    }

    if (!row.timestamp) {
      row.timestamp = parseInt(
        (new Date(row.createdAt).getTime() / 1000).toFixed(0)
      );
    }
    delete row.createdAt;
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
  const result = await pool.query(
    `SELECT id FROM transactions WHERE "blockHash" is NOT NULL`
  );
  return result.rows.map(({ id }) => id);
}

const transactionColumns = `"id", "blockHash", "ownerAddress", "appName", "tags", transactions."rawData"->'data' as content, transactions."rawData"->'reward' as fee, transactions."createdAt"`;

export async function getTransactionsByOptions({
  appName,
  walletId,
  userFeed
}) {
  let whereClause = `"appName" = $1`;
  const values = [appName];

  if (walletId) {
    whereClause = whereClause + ` AND "ownerAddress" = $2`;
    values.push(walletId);
  } else {
    if (userFeed) {
      whereClause = whereClause + `AND "ownerAddress" = ANY ($2)`;
      const userStats = await getUserStats({ ownerAddress: userFeed });
      values.push(userStats.followingIds);
    }
  }

  let text = `SELECT ${transactionColumns}, blocks."rawData"->'timestamp' as timestamp FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE ${whereClause} ORDER BY height DESC, transactions."createdAt" DESC`;

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
    text: `SELECT ${transactionColumns}, blocks."rawData"->'timestamp' as timestamp FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "id" = $1 `,
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

export async function getUser(address) {
  const result = await pool.query({
    text: `SELECT "ownerAddress" FROM transactions WHERE "ownerAddress" = $1 LIMIT 1`,
    values: [address]
  });

  return result.rows[0];
}

async function getUserFollowing(address) {
  const encodedGraphResult = await pool.query({
    text: `SELECT transactions."rawData"->'data' as "followAddress", tags, height FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "ownerAddress" = $1 AND "appName"='social-graph' ORDER BY height DESC, transactions."createdAt" DESC`,
    values: [address]
  });

  const graphResult = encodedGraphResult.rows.map(row => {
    return {
      ...row,
      followAddress: base64Decode(row.followAddress)
    };
  });

  const graphByFollowAddress = groupBy(graphResult, "followAddress");
  const followingIds = compact(
    Object.keys(graphByFollowAddress).map(address => {
      const row = graphByFollowAddress[address][0];
      const found = row.tags.find(
        tag => tag.name === "Action" && tag.value === "follow"
      );
      if (found) {
        return address;
      }
    })
  );

  return followingIds;
}

async function getUserFollowers(address) {
  const base64Address = base64Encode(address).replace(/=/g, "");
  const transactions = await pool.query({
    text: `SELECT id, height, tags, "ownerAddress" FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "appName"='social-graph' AND transactions."rawData"->>'data'= $1 ORDER BY height DESC, transactions."createdAt" DESC`,
    values: [base64Address]
  });

  const txByOwnerAddress = groupBy(transactions.rows, "ownerAddress");
  const followerIds = compact(
    Object.keys(txByOwnerAddress).map(address => {
      const row = txByOwnerAddress[address][0];
      const found = row.tags.find(
        tag => tag.name === "Action" && tag.value === "follow"
      );
      if (found) {
        return address;
      }
    })
  );

  return followerIds;
}

async function getUserPosts(address) {
  const postQueryResult = await pool.query({
    text: `SELECT id FROM transactions WHERE "ownerAddress" = $1 AND "appName"='arweave-blog-0.0.1'`,
    values: [address]
  });

  return postQueryResult.rows;
}

export async function getUserStats({ ownerAddress: address }) {
  const userPosts = await getUserPosts(address);
  const followingIds = await getUserFollowing(address);
  const followerIds = await getUserFollowers(address);

  return {
    id: address,
    postCount: userPosts.length,
    followerCount: followerIds.length,
    followingCount: followingIds.length,
    followerIds,
    followingIds
  };
}
