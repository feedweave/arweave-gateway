import Arweave from "arweave/node";
import fetchNode from "node-fetch";
import fetchRetry from "./util/fetch-retry";

import { saveFetchError } from "./data-db";

const { DEPLOY_WEBHOOK_URLS } = process.env;

async function fetch(url) {
  return fetchRetry(url).catch(async error => {
    console.log("in catch block of fetchRetry", error);
    await saveFetchError(url, error);
    throw error;
  });
}

const arweave = Arweave.init({
  host: "arweave.net",
  port: 443,
  protocol: "https"
});

const CHAIN_INFO_URL = `https://arweave.net/info`;

export async function ownerToAddress(owner) {
  const address = await arweave.wallets.ownerToAddress(owner);
  return address;
}

//TODO memoize requests??

export const base64Decode = string => {
  // eslint-disable-next-line no-undef
  return Buffer.from(string, "base64").toString("utf-8");
};

export const decodeTags = tags => {
  return tags.map(({ name, value }) => {
    return {
      name: base64Decode(name),
      value: base64Decode(value)
    };
  });
};

export async function getChainInfo() {
  const chainInfo = await fetch(CHAIN_INFO_URL).then(resp => resp.json());
  return chainInfo;
}

export async function getBlockAtHeight(height) {
  const block = await fetch(
    `https://arweave.net/block/height/${height}`
  ).then(x => x.json());
  return block;
}

export async function getBlockByHash(hash) {
  const block = await fetch(`https://arweave.net/block/hash/${hash}`).then(x =>
    x.json()
  );
  return block;
}

export async function getTagsForTx(txId) {
  const resp = await fetch(`https://arweave.net/tx/${txId}/tags`).then(resp =>
    resp.json()
  );
  return resp;
}

export async function getBlockForTx(txId) {
  const resp = await fetch(`https://arweave.net/tx/${txId}/status`).then(x =>
    x.json()
  );
  const block = await getBlockByHash(resp.block_indep_hash);
  return block;
}

export async function getTxById(txId) {
  const resp = await fetch(`https://arweave.net/tx/${txId}`).then(resp =>
    resp.json()
  );
  return resp;
}

export async function getTxWithBlockHash(txId) {
  const tx = await fetch(`https://arweave.net/tx/${txId}`).then(resp =>
    resp.json()
  );
  const txStatus = await fetch(
    `https://arweave.net/tx/${txId}/status`
  ).then(resp => resp.json());

  tx.blockHash = txStatus.block_indep_hash;
  return tx;
}

export async function getTxData(txId) {
  const tx = await getTxById(txId);
  return base64Decode(tx.data);
}

export async function getTxIdsByAppNames(appNames) {
  const arqlQuery = generateArqlQueryForAppNames(appNames);
  const txIds = await arweave.arql(arqlQuery);
  return txIds;
}

function arqlAppNameEqualsQuery(appName) {
  return {
    op: "equals",
    expr1: "App-Name",
    expr2: appName
  };
}

export function generateArqlQueryForAppNames(appNames) {
  if (appNames.length === 1) {
    return arqlAppNameEqualsQuery(appNames[0]);
  } else {
    const query = {
      op: "or"
    };
    query.expr1 = arqlAppNameEqualsQuery(appNames.pop());
    query.expr2 = generateArqlQueryForAppNames(appNames);
    return query;
  }
}

export async function callDeployWebhook() {
  const fetchPromises = DEPLOY_WEBHOOK_URLS.split(",").map(url =>
    fetchNode(url, { method: `POST` })
  );
  return await Promise.all(fetchPromises);
}
