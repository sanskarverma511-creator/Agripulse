require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { closeMongo, getDb } = require('../config/mongo');
const { ensureIndexes } = require('../services/bootstrap');
const { backfillHistoricalWeather } = require('../services/weatherBackfillService');

async function main() {
    try {
        const db = await getDb();
        await ensureIndexes(db);
        const result = await backfillHistoricalWeather(db);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await closeMongo();
    }
}

main().catch((error) => {
    console.error('Weather backfill failed:', error);
    process.exit(1);
});
