const { getDb } = require('./config/mongo');
const { ensureIndexes, seedDemoData } = require('./services/bootstrap');

async function run() {
    try {
        const db = await getDb();
        console.log('Connected to MongoDB');
        await ensureIndexes(db);
        const result = await seedDemoData(db);
        console.log('Demo seed complete', result);
        process.exit(0);
    } catch (err) {
        console.error('Bootstrap failed', err);
        process.exit(1);
    }
}

run();
