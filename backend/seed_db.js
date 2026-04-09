const { getDb } = require('./config/mongo');
const { ensurePlatformReady } = require('./services/bootstrap');

async function run() {
    try {
        const db = await getDb();
        console.log('Connected to MongoDB');
        const result = await ensurePlatformReady(db);
        console.log('Bootstrap complete', result);
        process.exit(0);
    } catch (err) {
        console.error('Bootstrap failed', err);
        process.exit(1);
    }
}

run();
