const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { parseCsv } = require('../utils/csv');
const { getPendingIngestFiles } = require('./acquisitionService');
const {
    getCommodityMetadata,
    normalizeDistrict,
    normalizeMarketName,
    normalizeState,
    POLICY_STATUSES,
    toSlug,
} = require('../utils/normalizers');

const SCHEMA_VERSION = 'ingest-v2';

function nowIso() {
    return new Date().toISOString();
}

function headerValue(row, names) {
    for (const name of names) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return row[name];
        }
    }
    return '';
}

function toNumber(value) {
    const parsed = Number(String(value || '').replace(/,/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
}

function normalizeDate(value) {
    const raw = String(value || '').trim();
    if (!raw) {
        return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    const slashMatch = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
    if (slashMatch) {
        const day = slashMatch[1].padStart(2, '0');
        const month = slashMatch[2].padStart(2, '0');
        const year = slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3];
        return `${year}-${month}-${day}`;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
        return null;
    }
    return parsed.toISOString().slice(0, 10);
}

function buildMarketId(state, district, marketName) {
    return `${toSlug(state)}-${toSlug(district)}-${toSlug(marketName)}`;
}

function buildSourceName(filePath, row, options = {}) {
    return (
        options.sourceName ||
        headerValue(row, ['source']) ||
        path.basename(filePath)
    );
}

function detectCsvSchema(rows) {
    if (!rows || rows.length === 0) {
        return { headers: [], schemaType: 'empty' };
    }

    const headers = Object.keys(rows[0]);
    const hasPriceColumns = headers.some((header) => [
        'modalprice',
        'price',
        'minprice',
        'maxprice',
    ].includes(header));
    const hasCommodity = headers.some((header) => [
        'commodity',
        'commodityname',
        'crop',
    ].includes(header));
    const hasWeatherColumns = headers.some((header) => [
        'humidity',
        'relativehumidity',
        'precipitation',
        'precipitationmm',
        'rainfall',
        'temperaturemax',
        'temperaturemin',
        'weathercode',
    ].includes(header));

    let schemaType = 'unknown';
    if (hasPriceColumns && hasCommodity && hasWeatherColumns) {
        schemaType = 'price_weather';
    } else if (hasPriceColumns && hasCommodity) {
        schemaType = 'price';
    } else if (hasWeatherColumns) {
        schemaType = 'weather';
    }

    return { headers, schemaType };
}

function stableFingerprint(parts) {
    return crypto.createHash('sha1').update(JSON.stringify(parts)).digest('hex');
}

function buildPriceFingerprint(doc) {
    return stableFingerprint([
        doc.marketId,
        doc.commodity,
        doc.date,
        doc.minPrice,
        doc.maxPrice,
        doc.modalPrice,
        doc.arrivalQty,
        doc.variety || '',
    ]);
}

function buildWeatherFingerprint(doc) {
    return stableFingerprint([
        doc.marketId,
        doc.date,
        doc.humidity,
        doc.precipitationMm,
        doc.temperatureMax,
        doc.temperatureMin,
        doc.weatherCode,
        doc.weatherResolution,
    ]);
}

async function quarantineRow(db, payload) {
    await db.collection('quarantine_rows').insertOne({
        ...payload,
        createdAt: nowIso(),
    });
}

async function upsertMarket(db, doc, commodityMeta, isEligibleCommodity) {
    const baseDoc = {
        _id: doc.marketId,
        code: doc.marketId.toUpperCase(),
        commodities: [doc.commodity],
        createdAt: nowIso(),
        commodityPolicy: {
            [doc.commodity]: commodityMeta,
        },
        district: doc.district,
        eligibleCommodities: isEligibleCommodity ? [doc.commodity] : [],
        estimatedDistanceKm: 24,
        excludedCommodities: isEligibleCommodity ? [] : [doc.commodity],
        lat: doc.lat,
        lon: doc.lon,
        name: doc.marketName,
        state: doc.state,
        status: 'Imported',
        updatedAt: nowIso(),
    };

    const update = {
        $set: {
            district: baseDoc.district,
            lat: baseDoc.lat,
            lon: baseDoc.lon,
            name: baseDoc.name,
            state: baseDoc.state,
            status: baseDoc.status,
            updatedAt: baseDoc.updatedAt,
            [`commodityPolicy.${doc.commodity}`]: commodityMeta,
        },
        $setOnInsert: baseDoc,
        $addToSet: { commodities: doc.commodity },
    };

    if (isEligibleCommodity) {
        update.$addToSet.eligibleCommodities = doc.commodity;
    } else {
        update.$addToSet.excludedCommodities = doc.commodity;
    }

    await db.collection('markets').updateOne({ _id: doc.marketId }, update, { upsert: true });
}

function priceCollectionName(options = {}) {
    if (options.sourceType === 'public_staging') {
        return 'staging_daily_prices';
    }
    return 'daily_prices';
}

function weatherCollectionName(options = {}) {
    if (options.sourceType === 'public_staging' || options.sourceType === 'public_weather') {
        return 'staging_weather_history';
    }
    return 'weather_history';
}

function certificationStatus(options = {}) {
    if (options.sourceType === 'public_staging' || options.sourceType === 'public_weather') {
        return 'pending_review';
    }
    return 'certified';
}

function isCertifiedImport(options = {}) {
    return certificationStatus(options) === 'certified';
}

function productionPriceFilter(doc, collectionName) {
    if (collectionName === 'daily_prices') {
        return {
            commodity: doc.commodity,
            date: doc.date,
            marketId: doc.marketId,
            source: doc.source,
        };
    }
    return { equivalenceKey: doc.equivalenceKey };
}

function productionWeatherFilter(doc, collectionName) {
    if (collectionName === 'weather_history') {
        return {
            date: doc.date,
            marketId: doc.marketId,
            source: doc.source,
        };
    }
    return { equivalenceKey: doc.equivalenceKey };
}

function buildBaseMetadata(filePath, row, options = {}) {
    return {
        approvalStatus: certificationStatus(options),
        ingestBatchId: options.ingestBatchId || null,
        isCertified: isCertifiedImport(options),
        isQuarantined: false,
        schemaVersion: SCHEMA_VERSION,
        source: buildSourceName(filePath, row, options),
        sourceName: options.sourceName || buildSourceName(filePath, row, options),
        sourceType: options.sourceType || 'official',
        sourceUrl: options.sourceUrl || '',
    };
}

function buildPriceDoc(row, filePath, options = {}) {
    const state = normalizeState(headerValue(row, ['state', 'statename']));
    const district = normalizeDistrict(headerValue(row, ['district', 'districtname']));
    const marketName = normalizeMarketName(
        headerValue(row, ['market', 'marketname', 'mandi', 'mandiname']),
    );
    const commodityMeta = getCommodityMetadata(
        headerValue(row, ['commodity', 'commodityname', 'crop']),
    );
    const commodity = commodityMeta?.id;
    const date = normalizeDate(
        headerValue(row, ['date', 'pricedate', 'arrivaldate']) ||
        headerValue(row, ['day']),
    );
    const minPrice = toNumber(headerValue(row, ['minprice', 'min']));
    const maxPrice = toNumber(headerValue(row, ['maxprice', 'max']));
    const modalPrice = toNumber(headerValue(row, ['modalprice', 'modal', 'price']));
    const arrivalQty = toNumber(headerValue(row, ['arrivalqty', 'arrival', 'quantity'])) || 0;

    if (!state || !district || !marketName || !commodity || !date || modalPrice === null) {
        return null;
    }

    const marketId = buildMarketId(state, district, marketName);
    const metadata = buildBaseMetadata(filePath, row, options);
    const doc = {
        ...metadata,
        arrivalQty,
        category: commodityMeta.category,
        commodity,
        date,
        district,
        ingestedAt: nowIso(),
        marketId,
        marketName,
        maxPrice: maxPrice ?? modalPrice,
        minPrice: minPrice ?? modalPrice,
        modalPrice,
        policyStatus: commodityMeta.policyStatus,
        sourceFingerprint: '',
        state,
        variety: headerValue(row, ['variety', 'varietyname']) || null,
    };
    doc.sourceFingerprint = buildPriceFingerprint(doc);
    doc.equivalenceKey = `${doc.marketId}|${doc.commodity}|${doc.date}|${doc.sourceFingerprint}`;
    return {
        commodityMeta,
        doc,
    };
}

async function resolveWeatherTargets(db, row) {
    const state = normalizeState(headerValue(row, ['state', 'statename']));
    const district = normalizeDistrict(headerValue(row, ['district', 'districtname']));
    const marketName = normalizeMarketName(
        headerValue(row, ['market', 'marketname', 'mandi', 'mandiname']),
    );

    if (state && district && marketName) {
        return [{
            district,
            marketId: buildMarketId(state, district, marketName),
            marketName,
            state,
            weatherResolution: 'market',
        }];
    }

    if (state && district) {
        const markets = await db.collection('markets').find({ state, district }).project({
            _id: 1,
            district: 1,
            name: 1,
            state: 1,
        }).toArray();

        return markets.map((market) => ({
            district: market.district,
            marketId: market._id,
            marketName: market.name,
            state: market.state,
            weatherResolution: 'district',
        }));
    }

    if (state) {
        const markets = await db.collection('markets').find({ state }).project({
            _id: 1,
            district: 1,
            name: 1,
            state: 1,
        }).toArray();

        return markets.map((market) => ({
            district: market.district,
            marketId: market._id,
            marketName: market.name,
            state: market.state,
            weatherResolution: 'state',
        }));
    }

    return [];
}

async function buildWeatherDocs(db, row, filePath, options = {}) {
    const humidity = toNumber(headerValue(row, ['humidity', 'relativehumidity']));
    const precipitationMm = toNumber(
        headerValue(row, ['precipitationmm', 'precipitation', 'rainfall', 'rainfallmm']),
    );
    const temperatureMax = toNumber(
        headerValue(row, ['temperaturemax', 'tempmax', 'maxtemp', 'maxtemperature']),
    );
    const temperatureMin = toNumber(
        headerValue(row, ['temperaturemin', 'tempmin', 'mintemp', 'mintemperature']),
    );
    const weatherCode = toNumber(headerValue(row, ['weathercode', 'weather_code']));
    const date = normalizeDate(
        headerValue(row, ['date', 'pricedate', 'arrivaldate']) ||
        headerValue(row, ['day']),
    );

    if (
        !date ||
        ![humidity, precipitationMm, temperatureMax, temperatureMin, weatherCode].some(
            (value) => value !== null,
        )
    ) {
        return [];
    }

    const targets = await resolveWeatherTargets(db, row);
    const metadata = buildBaseMetadata(filePath, row, options);
    return targets.map((target) => {
        const doc = {
            ...metadata,
            date,
            district: target.district,
            humidity,
            ingestedAt: nowIso(),
            marketId: target.marketId,
            marketName: target.marketName,
            precipitationMm,
            sourceFingerprint: '',
            state: target.state,
            temperatureMax,
            temperatureMin,
            weatherCode,
            weatherResolution: target.weatherResolution,
        };
        doc.sourceFingerprint = buildWeatherFingerprint(doc);
        doc.equivalenceKey = `${doc.marketId}|${doc.date}|${doc.sourceFingerprint}`;
        return doc;
    });
}

async function updateIngestFile(db, ingestFileId, patch) {
    if (!ingestFileId) {
        return;
    }
    await db.collection('ingest_files').updateOne(
        { _id: ingestFileId },
        { $set: patch },
    );
}

async function importCsvFile(db, filePath, options = {}) {
    const absolutePath = path.resolve(filePath);
    const csvText = fs.readFileSync(absolutePath, 'utf8');
    const rows = parseCsv(csvText);
    const { headers, schemaType } = detectCsvSchema(rows);
    const summary = {
        commodities: [],
        duplicateRows: 0,
        eligibleNonMspCommodities: [],
        eligibleNonMspRows: 0,
        excludedMspCommodities: [],
        excludedMspRows: 0,
        filePath: absolutePath,
        importedWeatherRows: 0,
        insertedRows: 0,
        isCertified: isCertifiedImport(options),
        marketsTouched: 0,
        quarantinedRows: 0,
        schemaType,
        skippedRows: 0,
        sourceType: options.sourceType || 'official',
        stagedRows: 0,
        states: [],
        totalRows: rows.length,
        updatedRows: 0,
        weatherDuplicates: 0,
    };

    if (schemaType === 'unknown' || schemaType === 'empty') {
        await quarantineRow(db, {
            filePath: absolutePath,
            ingestBatchId: options.ingestBatchId || null,
            ingestFileId: options.ingestFileId || null,
            rawRow: rows[0] || null,
            reason: `Unsupported schema type: ${schemaType}`,
            sourceName: options.sourceName || path.basename(filePath),
            sourceType: options.sourceType || 'official',
            sourceUrl: options.sourceUrl || '',
        });
        summary.quarantinedRows = rows.length || 1;
        await updateIngestFile(db, options.ingestFileId, {
            detectedSchema: schemaType,
            importStatus: 'quarantined',
            importedAt: nowIso(),
            metadata: {
                commodityCoverage: [],
                dateRange: null,
                detectedHeaders: headers,
                stateCoverage: [],
            },
        });
        return summary;
    }

    const touchedMarkets = new Set();
    const seenStates = new Set();
    const seenCommodities = new Set();
    const eligibleNonMspCommodities = new Set();
    const excludedMspCommodities = new Set();
    const priceCollection = priceCollectionName(options);
    const weatherCollection = weatherCollectionName(options);
    let minDate = null;
    let maxDate = null;

    for (const row of rows) {
        if (schemaType === 'price' || schemaType === 'price_weather') {
            const pricePayload = buildPriceDoc(row, filePath, options);
            if (!pricePayload) {
                summary.skippedRows += 1;
                await quarantineRow(db, {
                    filePath: absolutePath,
                    ingestBatchId: options.ingestBatchId || null,
                    ingestFileId: options.ingestFileId || null,
                    rawRow: row,
                    reason: 'Missing required price columns after normalization.',
                    sourceName: options.sourceName || path.basename(filePath),
                    sourceType: options.sourceType || 'official',
                    sourceUrl: options.sourceUrl || '',
                });
                summary.quarantinedRows += 1;
            } else {
                const { commodityMeta, doc } = pricePayload;
                const isEligibleCommodity =
                    commodityMeta.policyStatus === POLICY_STATUSES.ELIGIBLE_NON_MSP;

                await upsertMarket(db, doc, commodityMeta, isEligibleCommodity);
                const priceResult = await db.collection(priceCollection).updateOne(
                    productionPriceFilter(doc, priceCollection),
                    {
                        $set: doc,
                        $setOnInsert: {
                            _id: `${doc.marketId}-${doc.commodity}-${doc.date}-${doc.sourceFingerprint}`,
                        },
                    },
                    { upsert: true },
                );

                if (priceCollection === 'staging_daily_prices') {
                    summary.stagedRows += 1;
                }
                if (priceResult.upsertedCount > 0) {
                    summary.insertedRows += 1;
                } else if (priceResult.modifiedCount > 0) {
                    summary.updatedRows += 1;
                } else {
                    summary.duplicateRows += 1;
                }

                touchedMarkets.add(doc.marketId);
                seenStates.add(doc.state);
                seenCommodities.add(doc.commodity);
                minDate = !minDate || doc.date < minDate ? doc.date : minDate;
                maxDate = !maxDate || doc.date > maxDate ? doc.date : maxDate;
                if (isEligibleCommodity) {
                    summary.eligibleNonMspRows += 1;
                    eligibleNonMspCommodities.add(doc.commodity);
                } else if (commodityMeta.policyStatus === POLICY_STATUSES.EXCLUDED_MSP) {
                    summary.excludedMspRows += 1;
                    excludedMspCommodities.add(doc.commodity);
                }
            }
        }

        if (schemaType === 'weather' || schemaType === 'price_weather') {
            const weatherDocs = await buildWeatherDocs(db, row, filePath, options);
            if (weatherDocs.length === 0 && schemaType === 'weather') {
                summary.skippedRows += 1;
                await quarantineRow(db, {
                    filePath: absolutePath,
                    ingestBatchId: options.ingestBatchId || null,
                    ingestFileId: options.ingestFileId || null,
                    rawRow: row,
                    reason: 'Could not resolve weather row to any market/state target.',
                    sourceName: options.sourceName || path.basename(filePath),
                    sourceType: options.sourceType || 'official',
                    sourceUrl: options.sourceUrl || '',
                });
                summary.quarantinedRows += 1;
            }

            for (const weatherDoc of weatherDocs) {
                const weatherResult = await db.collection(weatherCollection).updateOne(
                    productionWeatherFilter(weatherDoc, weatherCollection),
                    {
                        $set: weatherDoc,
                        $setOnInsert: {
                            _id: `${weatherDoc.marketId}-${weatherDoc.date}-${weatherDoc.sourceFingerprint}`,
                        },
                    },
                    { upsert: true },
                );

                if (weatherCollection === 'staging_weather_history') {
                    summary.stagedRows += 1;
                }
                if (weatherResult.upsertedCount > 0 || weatherResult.modifiedCount > 0) {
                    summary.importedWeatherRows += 1;
                } else {
                    summary.weatherDuplicates += 1;
                }

                touchedMarkets.add(weatherDoc.marketId);
                seenStates.add(weatherDoc.state);
                minDate = !minDate || weatherDoc.date < minDate ? weatherDoc.date : minDate;
                maxDate = !maxDate || weatherDoc.date > maxDate ? weatherDoc.date : maxDate;
            }
        }
    }

    summary.marketsTouched = touchedMarkets.size;
    summary.states = [...seenStates].sort();
    summary.commodities = [...seenCommodities].sort();
    summary.eligibleNonMspCommodities = [...eligibleNonMspCommodities].sort();
    summary.excludedMspCommodities = [...excludedMspCommodities].sort();

    await db.collection('import_runs').insertOne({
        commodities: summary.commodities,
        createdAt: nowIso(),
        detectedHeaders: headers,
        duplicateRows: summary.duplicateRows,
        eligibleNonMspCommodities: summary.eligibleNonMspCommodities,
        eligibleNonMspRows: summary.eligibleNonMspRows,
        excludedMspCommodities: summary.excludedMspCommodities,
        excludedMspRows: summary.excludedMspRows,
        filePath: absolutePath,
        importedWeatherRows: summary.importedWeatherRows,
        ingestBatchId: options.ingestBatchId || null,
        ingestFileId: options.ingestFileId || null,
        insertedRows: summary.insertedRows,
        isCertified: summary.isCertified,
        marketsTouched: summary.marketsTouched,
        quarantinedRows: summary.quarantinedRows,
        schemaType,
        skippedRows: summary.skippedRows,
        sourceName: options.sourceName || path.basename(filePath),
        sourceType: summary.sourceType,
        sourceUrl: options.sourceUrl || '',
        stagedRows: summary.stagedRows,
        states: summary.states,
        totalRows: summary.totalRows,
        updatedRows: summary.updatedRows,
        weatherDuplicates: summary.weatherDuplicates,
    });

    await updateIngestFile(db, options.ingestFileId, {
        detectedSchema: schemaType,
        importStatus: summary.quarantinedRows > 0 && summary.insertedRows === 0 && summary.importedWeatherRows === 0
            ? 'quarantined'
            : 'imported',
        importedAt: nowIso(),
        metadata: {
            commodityCoverage: summary.commodities,
            dateRange: minDate && maxDate ? { max: maxDate, min: minDate } : null,
            detectedHeaders: headers,
            stateCoverage: summary.states,
        },
    });

    return summary;
}

async function importCsvFiles(db, filePaths, options = {}) {
    const results = [];
    for (const filePath of filePaths) {
        results.push(await importCsvFile(db, filePath, options));
    }
    return results;
}

async function importPendingDownloads(db, options = {}) {
    const ingestFiles = await getPendingIngestFiles(db, options.sourceType);
    const results = [];

    for (const ingestFile of ingestFiles) {
        const filePaths = ingestFile.extractedPaths?.length ? ingestFile.extractedPaths : [ingestFile.localPath];
        for (const filePath of filePaths) {
            if (!filePath || !fs.existsSync(filePath)) {
                await updateIngestFile(db, ingestFile._id, {
                    importStatus: 'failed',
                    importError: 'Downloaded file no longer exists on disk.',
                });
                continue;
            }

            results.push(await importCsvFile(db, filePath, {
                ingestBatchId: ingestFile.ingestBatchId,
                ingestFileId: ingestFile._id,
                sourceName: ingestFile.sourceName,
                sourceType: ingestFile.sourceType,
                sourceUrl: ingestFile.downloadUrl || '',
            }));
        }
    }

    return {
        files: ingestFiles.length,
        results,
    };
}

async function promoteStagedData(db) {
    const stagedPriceRows = await db.collection('staging_daily_prices')
        .find({ approvalStatus: { $in: ['pending_review', 'approved'] } })
        .sort({ ingestedAt: 1 })
        .toArray();
    const stagedWeatherRows = await db.collection('staging_weather_history')
        .find({ approvalStatus: { $in: ['pending_review', 'approved'] } })
        .sort({ ingestedAt: 1 })
        .toArray();

    const summary = {
        promotedPriceRows: 0,
        promotedWeatherRows: 0,
        skippedDuplicates: 0,
    };

    for (const row of stagedPriceRows) {
        const productionDoc = {
            ...row,
            approvalStatus: 'certified',
            certifiedAt: nowIso(),
            isCertified: true,
            sourceType: 'approved_public',
        };
        const result = await db.collection('daily_prices').updateOne(
            { equivalenceKey: productionDoc.equivalenceKey },
            {
                $set: productionDoc,
                $setOnInsert: {
                    _id: row._id,
                },
            },
            { upsert: true },
        );
        if (result.upsertedCount > 0 || result.modifiedCount > 0) {
            summary.promotedPriceRows += 1;
        } else {
            summary.skippedDuplicates += 1;
        }
        await db.collection('staging_daily_prices').updateOne(
            { _id: row._id },
            {
                $set: {
                    approvalStatus: 'promoted',
                    certifiedAt: productionDoc.certifiedAt,
                    promotedToCollection: 'daily_prices',
                },
            },
        );
    }

    for (const row of stagedWeatherRows) {
        const productionDoc = {
            ...row,
            approvalStatus: 'certified',
            certifiedAt: nowIso(),
            isCertified: true,
            sourceType: row.sourceType === 'public_weather' ? 'approved_public_weather' : 'approved_public',
        };
        const result = await db.collection('weather_history').updateOne(
            { equivalenceKey: productionDoc.equivalenceKey },
            {
                $set: productionDoc,
                $setOnInsert: {
                    _id: row._id,
                },
            },
            { upsert: true },
        );
        if (result.upsertedCount > 0 || result.modifiedCount > 0) {
            summary.promotedWeatherRows += 1;
        } else {
            summary.skippedDuplicates += 1;
        }
        await db.collection('staging_weather_history').updateOne(
            { _id: row._id },
            {
                $set: {
                    approvalStatus: 'promoted',
                    certifiedAt: productionDoc.certifiedAt,
                    promotedToCollection: 'weather_history',
                },
            },
        );
    }

    await db.collection('certification_runs').insertOne({
        ...summary,
        createdAt: nowIso(),
    });

    return summary;
}

module.exports = {
    detectCsvSchema,
    importCsvFile,
    importCsvFiles,
    importPendingDownloads,
    promoteStagedData,
};
