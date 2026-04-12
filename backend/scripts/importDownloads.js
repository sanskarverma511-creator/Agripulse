require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { closeMongo, getDb } = require('../config/mongo');
const { ensureIndexes } = require('../services/bootstrap');
const { importPendingDownloads } = require('../services/etlService');

async function main() {
    const sourceType = process.argv[2] || '';
    try {
        const db = await getDb();
        await ensureIndexes(db);
        const result = await importPendingDownloads(db, { sourceType: sourceType || undefined });
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await closeMongo();
    }
}

main().catch((error) => {
    console.error('Downloaded import failed:', error);
    process.exit(1);
});
