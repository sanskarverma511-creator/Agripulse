require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { closeMongo, getDb } = require('../config/mongo');
const { ensureIndexes } = require('../services/bootstrap');
const { fetchConfiguredSources } = require('../services/acquisitionService');

async function main() {
    const kind = process.argv[2] || 'all';
    try {
        const db = await getDb();
        await ensureIndexes(db);
        const result = await fetchConfiguredSources(db, kind);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await closeMongo();
    }
}

main().catch((error) => {
    console.error('Source fetch failed:', error);
    process.exit(1);
});
