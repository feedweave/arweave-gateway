import fetch from "node-fetch";

async function fetchRetry(url, options, maxAttempts, attempt) {
  return new Promise(function(resolve, reject) {
    fetch(url, options)
      .then(function(res) {
        if (res.ok) {
          resolve(res);
        } else {
          throw res.statusText;
        }
      })
      .catch(function(error) {
        if (attempt === maxAttempts) return reject(error);
        console.log("retrying fetch", url, maxAttempts, attempt, error);
        setTimeout(function() {
          resolve(fetchRetry(url, options, maxAttempts, attempt + 1));
        }, Math.pow(2, attempt + 1) * 1000);
      });
  });
}

export default function fetchRetryFive(url, options) {
  return fetchRetry(url, options, 3, 0);
}
