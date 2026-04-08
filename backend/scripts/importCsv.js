require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });

const { getDb } = require('../config/mongo');
const { ensureIndexes } = require('../services/bootstrap');
const { importCsvFiles } = require('../services/etlService');

async function main() {
    const files = process.argv.slice(2);
    if (files.length === 0) {
        console.error('Usage: npm run import:csv -- <file1.csv> <file2.csv>');
        process.exit(1);
    }

    const db = await getDb();
    await ensureIndexes(db);
    const results = await importCsvFiles(db, files);
    console.log(JSON.stringify({ imported: results }, null, 2));
}

main().catch((error) => {
    console.error('CSV import failed:', error);
    process.exit(1);
});
