import Arweave from "arweave/node";
import fetchNode from "node-fetch";
import fetchRetry from "fetch-retry";

async function fetch(url) {
  return fetchRetry(url, {
    retries: 5,
    retryDelay: function(attempt) {
      return Math.pow(2, attempt) * 1000; // 1000, 2000, 4000
    },
    retryOn: function(attempt, error, response) {
      // retry on any network error, or 4xx or 5xx status codes
      if (error !== null || response.status >= 400) {
        console.log(`fetch failed: ${url}`);
        console.log(error, response.status);
        console.log(`retrying, attempt number ${attempt}`);
        return true;
      }
    }
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

export async function getTxIdsByTag(tag) {
  const txIds = await arweave.arql({
    op: "equals",
    expr1: tag[0],
    expr2: tag[1]
  });

  return txIds;
}

export async function callDeployWebhook() {
  // eslint-disable-next-line no-undef
  await fetchNode(process.env.DEPLOY_WEBHOOK_URL, { method: `POST` });
}
