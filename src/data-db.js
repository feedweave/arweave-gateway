import dotenv from "dotenv";
dotenv.config();

import pg from "pg";
import groupBy from "lodash/groupBy";
import compact from "lodash/compact";
import uniq from "lodash/uniq";
import base64url from "base64url";
import {
  decodeTags,
  ownerToAddress,
  base64Decode,
  base64Encode,
} from "./util.js";
const { Pool } = pg;

const pool = new Pool();

const APP_NAME = process.env.APP_ENVIRONMENT;

function processTransactionRows(rows) {
  return rows.map((row) => {
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

const transactionColumns = `"id", "blockHash", "ownerAddress", "appName", "tags", transactions."rawData"->>'data' as content, transactions."rawData"->'reward' as fee, transactions."createdAt"`;

export async function getTransactionsByOptions({
  appName,
  walletId,
  userFeed,
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
    values,
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
    values,
  });
  return result.rows;
}

export async function getTransactionsByWalletAndApp(wallet, appName) {
  const result = await pool.query({
    text: `SELECT ${transactionColumns} FROM transactions WHERE "ownerAddress" = $1 AND "appName" = $2`,
    values: [wallet, appName],
  });
  return result.rows;
}

export async function getTransactionWithContent(transactionId) {
  const result = await pool.query({
    text: `SELECT ${transactionColumns}, blocks."rawData"->'timestamp' as timestamp FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "id" = $1 `,
    values: [transactionId],
  });

  const processedTx = processTransactionRows(result.rows)[0];
  return decorateTransactionWithLikesAndComments(processedTx);
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
    values: [hash],
  });
  return result.rows[0];
}

async function getTransaction(id) {
  const result = await pool.query({
    text: `SELECT * FROM transactions WHERE id = $1`,
    values: [id],
  });
  return result.rows[0];
}

export async function saveTransaction(transaction) {
  const { id, blockHash, owner } = transaction;

  const existingTransaction = await getTransaction(id);
  if (existingTransaction) {
    const updateQuery = {
      text: `UPDATE transactions SET "blockHash"=($1) WHERE id=($2) RETURNING *`,
      values: [blockHash, id],
    };
    const updateResult = await pool.query(updateQuery);
    return updateResult.rows[0];
  }

  const tags = decodeTags(transaction.tags);
  const appNameTag = tags.find((tag) => tag.name === `App-Name`);
  const appName = appNameTag && appNameTag.value;
  const tagsAsJson = JSON.stringify(tags);
  const ownerAddress = await ownerToAddress(owner);
  const query = {
    text: `INSERT INTO transactions("id", "blockHash", "rawData", "ownerAddress", "tags", "appName") VALUES($1, $2, $3, $4, $5, $6) RETURNING *`,
    values: [id, blockHash, transaction, ownerAddress, tagsAsJson, appName],
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
    values: [hash, height, timestamp, block],
  };

  const result = await pool.query(query);
  return result.rows[0];
}

export async function saveTransactionsAndBlocks(transactions, blocks) {
  const blockPromises = blocks.map((block) =>
    saveBlock(block).catch((err) => err)
  );
  const allBlockPromises = await Promise.all(blockPromises);
  const savedBlocks = allBlockPromises.filter(
    (result) => !(result instanceof Error)
  );

  const transactionPromises = transactions.map((transaction) =>
    saveTransaction(transaction).catch((err) => err)
  );
  const allTransactionPromises = await Promise.all(transactionPromises);
  const savedTransactions = allTransactionPromises.filter(
    (result) => !(result instanceof Error)
  );

  return {
    transactions: savedTransactions,
    blocks: savedBlocks,
  };
}

export async function saveFetchError(url, error) {
  const query = {
    text: `INSERT INTO errors("url", "error") VALUES($1, $2) RETURNING *`,
    values: [url, error],
  };
  const result = await pool.query(query);
  return result.rows;
}

export async function getUser(address) {
  const result = await pool.query({
    text: `SELECT "ownerAddress" FROM transactions WHERE "ownerAddress" = $1 LIMIT 1`,
    values: [address],
  });

  return result.rows[0];
}

async function getUserFollowing(address) {
  const encodedGraphResult = await pool.query({
    text: `SELECT transactions."rawData"->'data' as "followAddress", tags, height FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "ownerAddress" = $1 AND "appName"='social-graph' ORDER BY height DESC, transactions."createdAt" DESC`,
    values: [address],
  });

  const graphResult = encodedGraphResult.rows.map((row) => {
    return {
      ...row,
      followAddress: base64Decode(row.followAddress),
    };
  });

  const graphByFollowAddress = groupBy(graphResult, "followAddress");
  const followingIds = compact(
    Object.keys(graphByFollowAddress).map((address) => {
      const row = graphByFollowAddress[address][0];
      const found = row.tags.find(
        (tag) => tag.name === "Action" && tag.value === "follow"
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
    values: [base64Address],
  });

  const txByOwnerAddress = groupBy(transactions.rows, "ownerAddress");
  const followerIds = compact(
    Object.keys(txByOwnerAddress).map((address) => {
      const row = txByOwnerAddress[address][0];
      const found = row.tags.find(
        (tag) => tag.name === "Action" && tag.value === "follow"
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
    text: `SELECT id FROM transactions WHERE "ownerAddress" = $1 AND "appName"='${APP_NAME}'`,
    values: [address],
  });

  return postQueryResult.rows;
}

async function getUserArweaveId(address) {
  const idForAddress = await pool.query({
    text: `SELECT transactions."rawData"->'data' as name FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "appName"='arweave-id' AND tags @> '[{"name": "Type", "value": "name"}]' AND "ownerAddress"=$1 ORDER BY height DESC`,
    values: [address],
  });

  const row = idForAddress.rows[0];

  if (row) {
    const collisionIds = await pool.query({
      text: `SELECT transactions."rawData"->'data' as name, "ownerAddress" FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "appName"='arweave-id' AND tags @> '[{"name": "Type", "value": "name"}]' AND transactions."rawData"->>'data'=$1 ORDER BY height`,
      values: [row.name],
    });

    const firstRow = collisionIds.rows[0];

    if (firstRow.ownerAddress === address) {
      return base64Decode(firstRow.name);
    }
  }
}

async function getUserTwitterId(address) {
  const result = await pool.query({
    text: `SELECT "rawData"->'data' as handle FROM transactions WHERE "appName"='identity-link' AND tags @> '[{"name": "Provider", "value": "twitter"}]' AND "ownerAddress"=$1`,
    values: [address],
  });

  const row = result.rows[0];

  return row && base64Decode(row.handle);
}

export async function getUserStats({ ownerAddress: address }) {
  const userPosts = await getUserPosts(address);
  const followingIds = await getUserFollowing(address);
  const followerIds = await getUserFollowers(address);
  const arweaveId = await getUserArweaveId(address);
  const twitterId = await getUserTwitterId(address);

  return {
    id: address,
    arweaveId,
    twitterId,
    postCount: userPosts.length,
    followerIds,
    followingIds,
  };
}

export async function getUserByArweaveID(arweaveId) {
  const result = await pool.query({
    text: `SELECT "ownerAddress" FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "appName"='arweave-id' AND tags @> '[{"name": "Type", "value": "name"}]' AND transactions."rawData"->>'data' = $1 ORDER BY height, transactions."createdAt" LIMIT 1`,
    values: [base64url(arweaveId)],
  });

  return result.rows[0];
}

export async function getTxComments(txId) {
  const object = `[{"name": "Transaction-ID", "value": "${txId}"}]`;
  const result = await pool.query({
    text: `SELECT transactions."rawData"->'data' as content, "ownerAddress", id, tags, transactions."createdAt" FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "appName"='transaction-comment' AND tags @> $1 ORDER BY height DESC, transactions."createdAt" DESC`,
    values: [object],
  });

  return processTransactionRows(result.rows);
}

export async function getTxLikes(txId) {
  const object = `[{"name": "Transaction-ID", "value": "${txId}"}]`;
  const result = await pool.query({
    text: `SELECT transactions."rawData"->'data' as content, "ownerAddress", id, tags, transactions."createdAt" FROM transactions LEFT JOIN blocks on transactions."blockHash"=blocks.hash WHERE "appName"='transaction-like' AND tags @> $1 ORDER BY height DESC, transactions."createdAt" DESC`,
    values: [object],
  });

  const processedRows = processTransactionRows(result.rows);
  const rowsByOwner = groupBy(processedRows, "ownerAddress");

  const likes = Object.keys(rowsByOwner).map((owner) => {
    const latestLike = rowsByOwner[owner][0];

    const actionTag = latestLike.tags.find((tag) => tag.name === `Action`);
    if (actionTag && actionTag.value === "like") {
      return latestLike;
    }
  });

  return compact(likes);
}

async function decorateTransactionWithLikesAndComments(tx) {
  const likes = await getTxLikes(tx.id);
  const comments = await getTxComments(tx.id);
  const decoratedComments = await Promise.all(
    comments.map((c) => decorateTransactionWithLikesAndComments(c))
  );

  const commentParentUser = await getUserStats(tx);
  const commentsWithParentId = decoratedComments.map((c) => {
    return { ...c, parentTxId: tx.id, parentUser: commentParentUser };
  });

  const likeUserIds = likes.map((c) => c.ownerAddress);
  const commentUserIds = comments.map((c) => c.ownerAddress);

  const userIds = uniq([...likeUserIds, ...commentUserIds]);

  const users = await Promise.all(
    userIds.map((id) => getUserStats({ ownerAddress: id }))
  );

  return {
    ...tx,
    likes,
    comments: commentsWithParentId,
    users,
  };
}

function countNestedComments(tx) {
  let count = 0;

  tx.comments.forEach((c) => {
    count++;

    const nestedCount = countNestedComments(c);
    count = count + nestedCount;
  });

  return count;
}

async function getCommentsAndLikes(tx) {
  const decoratedTx = await decorateTransactionWithLikesAndComments(tx);

  const commentsCount = countNestedComments(decoratedTx);

  return { likes: decoratedTx.likes, commentsCount };
}

async function getParentUserAndTxId(tx) {
  const parentTxTag = tx.tags.find((t) => t.name === "Transaction-ID");
  const parentTxId = parentTxTag && parentTxTag.value;

  if (!parentTxId) {
    return {};
  }

  const parentTx = await getTransactionWithContent(parentTxId);
  const parentUser = await getUserStats(parentTx);
  return { parentUser, parentTxId };
}

async function decorateFollowTx(tx) {
  const { content: followedUserId } = tx;

  const followedUser = await getUserStats({ ownerAddress: followedUserId });

  return { ...tx, followedUser };
}
async function decorateCommentTx(tx) {
  const { parentUser, parentTxId } = await getParentUserAndTxId(tx);

  const { likes, commentsCount } = await getCommentsAndLikes(tx);

  return { ...tx, parentUser, parentTxId, likes, commentsCount };
}
async function decorateLikeTx(tx) {
  const { parentUser, parentTxId } = await getParentUserAndTxId(tx);

  return { ...tx, parentUser, parentTxId };
}

function decorateTransaction(tx) {
  switch (tx.appName) {
    case SOCIAL_GRAPH_APP_NAME:
      return decorateFollowTx(tx);
    case TRANSACTION_COMMENT_APP_NAME:
      return decorateCommentTx(tx);
    case TRANSACTION_LIKE_APP_NAME:
      return decorateLikeTx(tx);
    default:
      return decorateTransactionWithLikesAndComments(tx);
  }
}

async function decorateTransactions(transactions) {
  return Promise.all(
    transactions.map(async (tx) => {
      const decoratedTx = await decorateTransaction(tx);
      return decoratedTx;
    })
  );
}

const SOCIAL_GRAPH_APP_NAME = "social-graph";
const TRANSACTION_COMMENT_APP_NAME = "transaction-comment";
const TRANSACTION_LIKE_APP_NAME = "transaction-like";

export async function getFeed(cursor, { showActivity, address, followedBy }) {
  let whereClause = `"appName" = '${APP_NAME}'`;

  if (showActivity) {
    whereClause = `("appName" = '${APP_NAME}' OR "appName" = '${SOCIAL_GRAPH_APP_NAME}' OR "appName" = '${TRANSACTION_COMMENT_APP_NAME}' OR "appName" = '${TRANSACTION_LIKE_APP_NAME}')`;
  }

  const values = [];
  let valueCount = 1;

  if (cursor) {
    whereClause = whereClause + ` AND "seqID" <= $${valueCount}`;
    values.push(cursor);
    valueCount++;
  }

  if (address) {
    whereClause = whereClause + ` AND "ownerAddress" = $${valueCount}`;
    values.push(address);
    valueCount++;
  }

  if (followedBy) {
    whereClause = whereClause + ` AND "ownerAddress" = ANY ($${valueCount})`;
    const userStats = await getUserStats({ ownerAddress: followedBy });
    values.push(userStats.followingIds);
    valueCount++;
  }

  let text = `SELECT ${transactionColumns}, "seqID" FROM transactions WHERE ${whereClause} ORDER BY "seqID" DESC LIMIT 16`;

  const result = await pool.query({ text, values });

  const processedTxs = processTransactionRows(result.rows);
  const transactions = await decorateTransactions(processedTxs);
  let cursorTx = {};

  if (transactions.length === 16) {
    cursorTx = transactions.pop();
  }

  const ownerAddresses = uniq(transactions.map((tx) => tx.ownerAddress));
  const usersPromises = ownerAddresses.map((addr) =>
    getUserStats({ ownerAddress: addr })
  );
  const users = await Promise.all(usersPromises);

  return { transactions, users, nextCursor: cursorTx.seqID };
}
