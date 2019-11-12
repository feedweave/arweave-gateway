import { syncIteration } from './data-sync.js'

async function runTest() {
    const existingBlocks = []
    const options = {
        appName: `scribe-alpha-00`
    }
    const result = await syncIteration(existingBlocks, options);
}

runTest();