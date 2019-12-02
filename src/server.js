import dotenv from "dotenv";
dotenv.config();

import request from "request";

import express from "express";
const server = express();

import {
  getTransactionsByAppName,
  getTransactionsByWallet,
  getTransactionsByWalletAndApp,
  getTransactionContent,
  getAppNames,
  saveTransaction
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
      res.sendStatus(500);
    }
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

server.get("/transactions/app-name/:appName", async (req, res) => {
  const appName = req.params.appName;
  const transactions = await getTransactionsByAppName(appName);
  res.json(transactions);
});

server.get("/transaction/:transactionId/content", async (req, res) => {
  const transactionId = req.params.transactionId;
  const content = await getTransactionContent(transactionId);
  res.send(content);
});

server.get("/user/:address/transactions", async (req, res) => {
  const address = req.params.address;
  const transactions = await getTransactionsByWallet(address);
  res.json(transactions);
});

server.get(
  "/user/:address/app-name/:appName/transactions",
  async (req, res) => {
    const { address, appName } = req.params;
    const transactions = await getTransactionsByWalletAndApp(address, appName);
    res.json(transactions);
  }
);

//  TODO blog-app-api view
// `/user/:twitter-handle`
// `/user/:twitter-handle/:post-slug`

const port = 4000;

server.listen(port, () => {
  console.log(`Server listening at ${port}`);
});
