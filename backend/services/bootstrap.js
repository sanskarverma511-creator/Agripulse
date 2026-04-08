const { getSeedPayload } = require('../data/seedData');

async function ensureIndexes(db) {
    await db.collection('markets').createIndex({ state: 1, district: 1, name: 1 });
    await db.collection('daily_prices').createIndex({ marketId: 1, commodity: 1, date: -1 });
    await db.collection('daily_prices').createIndex(
        { marketId: 1, commodity: 1, date: 1, source: 1 },
        { unique: true },
    );
    await db.collection('forecasts').createIndex({ marketId: 1, commodity: 1, forecastDate: 1 });
    await db.collection('alerts').createIndex({ commodity: 1, state: 1, district: 1, status: 1 });
    await db.collection('model_versions').createIndex({ commodity: 1, taskType: 1, isActive: 1 });
    await db.collection('weather_snapshots').createIndex({ marketId: 1 }, { unique: true });
    await db.collection('weather_snapshots').createIndex({ state: 1, district: 1, fetchedAt: -1 });
}

async function syncSeedData(db) {
    const seed = getSeedPayload();
    const activeModelIds = seed.modelVersions.map((modelVersion) => modelVersion._id);
    const activeCommodities = [...new Set(seed.modelVersions.map((modelVersion) => modelVersion.commodity))];

    const marketOps = seed.markets.map((market) => ({
        updateOne: {
            filter: { _id: market._id },
            update: {
                $addToSet: { commodities: { $each: market.commodities } },
                $set: {
                    code: market.code,
                    district: market.district,
                    estimatedDistanceKm: market.estimatedDistanceKm,
                    lat: market.lat,
                    lon: market.lon,
                    name: market.name,
                    priceBias: market.priceBias,
                    state: market.state,
                    status: market.status,
                    updatedAt: market.updatedAt,
                },
                $setOnInsert: {
                    createdAt: market.createdAt,
                },
            },
            upsert: true,
        },
    }));

    const priceOps = seed.prices.map((price) => ({
        updateOne: {
            filter: { _id: price._id },
            update: { $set: price },
            upsert: true,
        },
    }));

    const modelOps = seed.modelVersions.map((modelVersion) => ({
        updateOne: {
            filter: { _id: modelVersion._id },
            update: { $set: modelVersion },
            upsert: true,
        },
    }));

    const [marketResult, priceResult, modelResult] = await Promise.all([
        db.collection('markets').bulkWrite(marketOps, { ordered: false }),
        db.collection('daily_prices').bulkWrite(priceOps, { ordered: false }),
        db.collection('model_versions').bulkWrite(modelOps, { ordered: false }),
    ]);
    const deactivatedModels = await db.collection('model_versions').updateMany(
        {
            _id: { $nin: activeModelIds },
            commodity: { $in: activeCommodities },
            isActive: true,
        },
        {
            $set: { isActive: false },
        },
    );

    return {
        deactivatedModelVersions: deactivatedModels.modifiedCount,
        marketUpserts: marketResult.upsertedCount,
        marketUpdates: marketResult.modifiedCount,
        markets: seed.markets.length,
        modelVersionUpserts: modelResult.upsertedCount,
        modelVersionUpdates: modelResult.modifiedCount,
        priceUpserts: priceResult.upsertedCount,
        priceUpdates: priceResult.modifiedCount,
        prices: seed.prices.length,
        seeded: true,
    };
}

async function ensurePlatformReady(db) {
    await ensureIndexes(db);
    return syncSeedData(db);
}

module.exports = {
    ensureIndexes,
    ensurePlatformReady,
};
