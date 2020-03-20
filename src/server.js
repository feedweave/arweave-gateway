import dotenv from "dotenv";
dotenv.config();

import fetch from "node-fetch";
import request from "request";

import express from "express";
const server = express();

import cors from "cors";

import uniq from "lodash/uniq";

import {
  getTransactionsByOptions,
  getTransactionWithContent,
  getAppNames,
  saveTransaction,
  getUserStats,
  getUserByArweaveID,
  getTxComments,
  getFeed
} from "./data-db.js";

import { callDeployWebhook } from "./util.js";

// TODO block-explorer-api
// `/user/:address/app-name/:app-name/following`
// `/user/:address/app-name/:app-name/followers`

server.use(express.json());

// Pipe requests intended for Arweave gateway

const apiUrl = "https://arweave.net";

server.post("/tx", async function(req, res) {
  const tx = req.body;
  const postRes = await fetch(`${apiUrl}/tx`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(tx)
  });

  if (postRes.ok) {
    try {
      await saveTransaction(tx);
      await callDeployWebhook();
      res.sendStatus(201);
    } catch (error) {
      console.log(error);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(postRes.statusText);
  }
});

server.use(["/tx", "/tx_anchor", "/price", "/wallet"], function(req, res) {
  var url = apiUrl + req.originalUrl;
  req.pipe(request({ qs: req.query, uri: url, json: true })).pipe(res);
});

server.get("/app-names", async (req, res) => {
  const appNames = await getAppNames();
  res.json(appNames);
});

server.get("/post-feed", cors(), async (req, res) => {
  const cursor = req.query["cursor"];
  const { transactions, users, nextCursor } = await getFeed(cursor);

  res.json({ transactions, users, nextCursor });
});

server.get("/transactions", cors(), async (req, res) => {
  const appName = req.query["app-name"];
  const walletId = req.query["wallet-id"];
  const userFeed = req.query["user-feed"];

  const page = req.query.page;

  const transactions = await getTransactionsByOptions({
    appName,
    walletId,
    userFeed,
    page
  });
  const ownerAddresses = uniq(transactions.map(tx => tx.ownerAddress));
  const usersPromises = ownerAddresses.map(addr =>
    getUserStats({ ownerAddress: addr })
  );
  const users = await Promise.all(usersPromises);

  res.json({ transactions, users });
});

server.get("/transaction/:transactionId", cors(), async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await getTransactionWithContent(transactionId);
  if (transaction) {
    const user = await getUserStats({ ownerAddress: transaction.ownerAddress });
    res.send({ transaction, user });
  } else {
    res.sendStatus(404);
  }
});

server.get("/transaction/:transactionId/comments", cors(), async (req, res) => {
  const { transactionId } = req.params;
  const transaction = await getTransactionWithContent(transactionId);
  if (transaction) {
    const comments = await getTxComments(transaction.id);
    const userIds = uniq(comments.map(c => c.ownerAddress));
    const users = await Promise.all(
      userIds.map(id => getUserStats({ ownerAddress: id }))
    );
    res.send({ comments, users });
  } else {
    res.sendStatus(404);
  }
});

server.get("/arweave-social/user/:address", cors(), async (req, res) => {
  const { address } = req.params;

  try {
    const userStats = await getUserStats({ ownerAddress: address });
    const relatedUserIds = uniq([
      ...userStats.followerIds,
      ...userStats.followingIds
    ]);
    const relatedUsers = await Promise.all(
      relatedUserIds.map(id => getUserStats({ ownerAddress: id }))
    );
    res.json({ user: userStats, relatedUsers });
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

server.get(
  "/arweave-social/check-arweave-id/:name",
  cors(),
  async (req, res) => {
    const { name } = req.params;

    const user = await getUserByArweaveID(name);

    if (user) {
      res.json(user);
    } else {
      res.sendStatus(404);
    }
  }
);

//  TODO blog-app-api view
// `/user/:twitter-handle`
// `/user/:twitter-handle/:post-slug`

// /blog-api/feed?page[size]=20&page[after]=:tx_id
// /blog-api/post/:post_id
// /blog-api/user/:wallet_address?page[size]=20&page[after]=:tx_id
// /blog-api/user/:wallet_address/following
// /blog-api/user/:wallet_address/followers

const port = 4000;

server.listen(port, () => {
  console.log(`Server listening at ${port}`);
});
