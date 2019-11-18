import dotenv from "dotenv";
dotenv.config();

import request from "request";

import express from "express";
const server = express();


import {
  getTransactionsByAppName,
  getTransactionsByWallet,
  getTransactionsByWalletAndApp,
  getTransactionContent
} from "./data-db.js";

// TODO block-explorer-api
// `/user/:address/app-name/:app-name/following`
// `/user/:address/app-name/:app-name/followers`

server.use(express.json())

// Pipe requests intended for Arweave gateway

const apiUrl = "https://arweave.net";
server.use(["/tx", "/tx_anchor", "/price", "/wallet"], function(req, res) {
  var url = apiUrl + req.originalUrl;
  req.pipe(request({ qs:req.query, uri: url, json: true })).pipe(res);
})

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
