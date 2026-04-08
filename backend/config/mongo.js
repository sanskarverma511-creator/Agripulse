const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const MONGODB_DB = process.env.MONGODB_DB || 'agri_market_intel';

let clientPromise;

async function getClient() {
    if (!clientPromise) {
        const client = new MongoClient(MONGODB_URI);
        clientPromise = client.connect();
    }

    return clientPromise;
}

async function getDb() {
    const client = await getClient();
    return client.db(MONGODB_DB);
}

async function closeMongo() {
    if (!clientPromise) {
        return;
    }

    const client = await clientPromise;
    await client.close();
    clientPromise = null;
}

module.exports = {
    MONGODB_DB,
    MONGODB_URI,
    closeMongo,
    getClient,
    getDb,
};
