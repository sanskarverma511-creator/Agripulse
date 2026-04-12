require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { closeMongo, getDb } = require('../config/mongo');
const { ensureIndexes } = require('../services/bootstrap');
const { promoteStagedData } = require('../services/etlService');

async function main() {
    try {
        const db = await getDb();
        await ensureIndexes(db);
        const result = await promoteStagedData(db);
        console.log(JSON.stringify(result, null, 2));
    } finally {
        await closeMongo();
    }
}

main().catch((error) => {
    console.error('Certification failed:', error);
    process.exit(1);
});
