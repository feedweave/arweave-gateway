import dotenv from "dotenv";
dotenv.config();

import express from "express";
const server = express();

import {
  getTransactionsByAppName,
  getTransactionsByWallet,
  getTransactionsByWalletAndApp
} from "./data-db.js";

// TODO block-explorer-api
// `/user/:address/app-name/:app-name/following`
// `/user/:address/app-name/:app-name/followers`

server.get("/transactions/app-name/:appName", async (req, res) => {
  const appName = req.params.appName;
  const transactions = await getTransactionsByAppName(appName);
  res.json(transactions);
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
