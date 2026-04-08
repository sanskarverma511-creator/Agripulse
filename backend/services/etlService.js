const fs = require('fs');
const path = require('path');

const { parseCsv } = require('../utils/csv');
const {
    normalizeCommodity,
    normalizeDistrict,
    normalizeMarketName,
    normalizeState,
    toSlug,
} = require('../utils/normalizers');

function headerValue(row, names) {
    for (const name of names) {
        if (row[name]) {
            return row[name];
        }
    }
    return '';
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function buildMarketId(state, district, marketName) {
    return `${toSlug(state)}-${toSlug(district)}-${toSlug(marketName)}`;
}

async function importCsvFile(db, filePath) {
    const absolutePath = path.resolve(filePath);
    const csvText = fs.readFileSync(absolutePath, 'utf8');
    const rows = parseCsv(csvText);
    const summary = {
        duplicateRows: 0,
        filePath: absolutePath,
        insertedRows: 0,
        skippedRows: 0,
        totalRows: rows.length,
        updatedRows: 0,
    };

    for (const row of rows) {
        const state = normalizeState(headerValue(row, ['state', 'statename']));
        const district = normalizeDistrict(headerValue(row, ['district', 'districtname']));
        const marketName = normalizeMarketName(
            headerValue(row, ['market', 'marketname', 'mandi', 'mandiname']),
        );
        const commodity = normalizeCommodity(
            headerValue(row, ['commodity', 'commodityname', 'crop']),
        );
        const date =
            headerValue(row, ['date', 'pricedate', 'arrivaldate']) ||
            headerValue(row, ['day']);
        const minPrice = toNumber(headerValue(row, ['minprice', 'min']));
        const maxPrice = toNumber(headerValue(row, ['maxprice', 'max']));
        const modalPrice = toNumber(headerValue(row, ['modalprice', 'modal', 'price']));
        const arrivalQty = toNumber(headerValue(row, ['arrivalqty', 'arrival', 'quantity'])) || 0;

        if (!state || !district || !marketName || !commodity || !date || modalPrice === null) {
            summary.skippedRows += 1;
            continue;
        }

        const marketId = buildMarketId(state, district, marketName);
        const marketDoc = {
            _id: marketId,
            code: marketId.toUpperCase(),
            commodities: [commodity],
            createdAt: new Date().toISOString(),
            district,
            estimatedDistanceKm: 24,
            lat: toNumber(headerValue(row, ['lat', 'latitude'])),
            lon: toNumber(headerValue(row, ['lon', 'longitude'])),
            name: marketName,
            state,
            status: 'Imported',
            updatedAt: new Date().toISOString(),
        };

        await db.collection('markets').updateOne(
            { _id: marketId },
            {
                $set: {
                    district: marketDoc.district,
                    lat: marketDoc.lat,
                    lon: marketDoc.lon,
                    name: marketDoc.name,
                    state: marketDoc.state,
                    status: marketDoc.status,
                    updatedAt: marketDoc.updatedAt,
                },
                $setOnInsert: marketDoc,
                $addToSet: { commodities: commodity },
            },
            { upsert: true },
        );

        const source = headerValue(row, ['source']) || path.basename(filePath);
        const result = await db.collection('daily_prices').updateOne(
            { commodity, date, marketId, source },
            {
                $set: {
                    arrivalQty,
                    commodity,
                    date,
                    district,
                    ingestedAt: new Date().toISOString(),
                    marketId,
                    maxPrice: maxPrice ?? modalPrice,
                    minPrice: minPrice ?? modalPrice,
                    modalPrice,
                    source,
                    state,
                },
                $setOnInsert: {
                    _id: `${marketId}-${commodity}-${date}-${source}`,
                },
            },
            { upsert: true },
        );

        if (result.upsertedCount > 0) {
            summary.insertedRows += 1;
        } else if (result.modifiedCount > 0) {
            summary.updatedRows += 1;
        } else {
            summary.duplicateRows += 1;
        }
    }

    return summary;
}

async function importCsvFiles(db, filePaths) {
    const results = [];
    for (const filePath of filePaths) {
        results.push(await importCsvFile(db, filePath));
    }
    return results;
}

module.exports = {
    importCsvFile,
    importCsvFiles,
};
