const { getDb } = require('../config/mongo');
const { forecastMarket, predictMarkets } = require('./modelClient');
const { getWeatherForMarket } = require('./weatherService');
const {
    getCommodityLabels,
    getCommodityMetadata,
    getCommodityPolicy,
    normalizeState,
    POLICY_STATUSES,
} = require('../utils/normalizers');

const MIN_ACTIVE_RECORDS = 10;
const MAX_MARKETS_PER_SCOPE = 10;

function badRequest(message) {
    const error = new Error(message);
    error.statusCode = 400;
    return error;
}

function maybeNumber(value) {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
}

function validateState(value) {
    const state = normalizeState(value);
    if (!state) {
        throw badRequest('State is required.');
    }
    return state;
}

function validateCommodity(value) {
    const commodityMeta = getCommodityMetadata(value);
    if (!commodityMeta?.id) {
        throw badRequest('Commodity is required.');
    }
    if (commodityMeta.policyStatus !== POLICY_STATUSES.ELIGIBLE_NON_MSP) {
        throw badRequest('This commodity is MSP-governed and is excluded from AgriPulse forecasting.');
    }
    return commodityMeta.id;
}

function isEligibleCommodity(commodity) {
    return getCommodityPolicy(commodity) === POLICY_STATUSES.ELIGIBLE_NON_MSP;
}

function commodityMarketQuery(commodity) {
    return {
        $or: [
            { eligibleCommodities: commodity },
            { commodities: commodity },
        ],
    };
}

async function getPriceHistory(db, marketId, commodity, limit = 30) {
    const docs = await db
        .collection('daily_prices')
        .find({ commodity, marketId })
        .sort({ date: -1 })
        .limit(limit)
        .toArray();

    return docs.reverse();
}

function serializeHistory(history) {
    return history.map((entry) => ({
        arrivalQty: entry.arrivalQty,
        date: entry.date,
        maxPrice: entry.maxPrice,
        minPrice: entry.minPrice,
        modalPrice: entry.modalPrice,
        source: entry.source,
    }));
}

function buildTrendLabel(history) {
    if (history.length < 4) {
        return 'Limited history';
    }

    const last = history[history.length - 1].modalPrice;
    const reference =
        history.slice(-4, -1).reduce((sum, item) => sum + item.modalPrice, 0) / 3;
    const delta = last - reference;

    if (delta > 60) {
        return 'Rising';
    }
    if (delta < -60) {
        return 'Cooling';
    }
    return 'Stable';
}

function buildArrivalSummary(history) {
    const arrivals = history.map((entry) => entry.arrivalQty || 0);
    const latestArrivalQty = arrivals[arrivals.length - 1] || 0;
    const averageArrivalQty =
        arrivals.length > 0
            ? Math.round(arrivals.reduce((sum, item) => sum + item, 0) / arrivals.length)
            : 0;

    return {
        averageArrivalQty,
        latestArrivalQty,
    };
}

function buildDataSourceSummary(history) {
    const counts = history.reduce((accumulator, point) => {
        const key = point.source || 'unknown';
        accumulator[key] = (accumulator[key] || 0) + 1;
        return accumulator;
    }, {});
    const sources = Object.keys(counts).sort();
    const importedSources = sources.filter((source) => source !== 'seed-bootstrap');

    return {
        counts,
        mode: importedSources.length > 0 ? 'real' : 'demo',
        sourceCount: sources.length,
        sources,
    };
}

async function buildCandidate(db, market, commodity) {
    const [history, weather] = await Promise.all([
        getPriceHistory(db, market._id, commodity, 24),
        getWeatherForMarket(db, market),
    ]);

    if (history.length < MIN_ACTIVE_RECORDS) {
        return null;
    }

    return {
        dataSource: buildDataSourceSummary(history),
        district: market.district,
        estimatedDistanceKm: market.estimatedDistanceKm || 24,
        history: serializeHistory(history),
        marketId: market._id,
        marketName: market.name,
        state: market.state,
        weather,
    };
}

async function getCandidatePayload(state, district, commodity, marketId) {
    const db = await getDb();
    let searchScope = 'district';
    let markets = [];

    if (marketId) {
        searchScope = 'market';
        const market = await db.collection('markets').findOne({ _id: marketId });
        if (!market) {
            const error = new Error('Market not found.');
            error.statusCode = 404;
            throw error;
        }
        markets = [market];
    } else {
        markets = await db
            .collection('markets')
            .find({ ...commodityMarketQuery(commodity), district, state })
            .sort({ name: 1 })
            .limit(MAX_MARKETS_PER_SCOPE)
            .toArray();

        if (markets.length === 0) {
            searchScope = 'state';
            markets = await db
                .collection('markets')
                .find({ ...commodityMarketQuery(commodity), state })
                .sort({ name: 1 })
                .limit(MAX_MARKETS_PER_SCOPE)
                .toArray();
        }
    }

    const candidates = (await Promise.all(markets.map((market) => buildCandidate(db, market, commodity))))
        .filter(Boolean);

    if (candidates.length === 0) {
        throw badRequest('No market data is available for this commodity in the selected region.');
    }

    return {
        candidates,
        searchScope,
    };
}

async function getStates() {
    const db = await getDb();
    const stateDocs = await db.collection('daily_prices').aggregate([
        {
            $group: {
                _id: '$state',
                commodities: { $addToSet: '$commodity' },
            },
        },
        { $sort: { _id: 1 } },
    ]).toArray();

    return stateDocs
        .filter((entry) => entry.commodities.some(isEligibleCommodity))
        .map((entry) => entry._id)
        .sort();
}

async function getDistricts(stateInput) {
    const state = validateState(stateInput);
    const db = await getDb();
    const districtDocs = await db.collection('daily_prices').aggregate([
        { $match: { state } },
        {
            $group: {
                _id: '$district',
                commodities: { $addToSet: '$commodity' },
            },
        },
        { $sort: { _id: 1 } },
    ]).toArray();
    const districts = districtDocs
        .filter((entry) => entry.commodities.some(isEligibleCommodity))
        .map((entry) => entry._id);
    return { districts: districts.sort(), state };
}

async function getMarkets(input = {}) {
    const state = validateState(input.state);
    const district = String(input.district || '').trim();
    if (!district) {
        throw badRequest('District is required.');
    }

    const commodity = input.commodity ? validateCommodity(input.commodity) : null;
    const query = { district, state };
    if (commodity) {
        Object.assign(query, commodityMarketQuery(commodity));
    }

    const db = await getDb();
    const markets = await db
        .collection('markets')
        .find(query)
        .sort({ name: 1 })
        .limit(MAX_MARKETS_PER_SCOPE)
        .toArray();

    return {
        district,
        markets: markets.map((market) => ({
            estimatedDistanceKm: market.estimatedDistanceKm || null,
            id: market._id,
            name: market.name,
            state: market.state,
        })),
        state,
    };
}

async function getCommodities(stateInput) {
    const state = validateState(stateInput);
    const db = await getDb();
    const commodities = await db
        .collection('daily_prices')
        .aggregate([
            { $match: { state } },
            {
                $group: {
                    _id: '$commodity',
                    recordCount: { $sum: 1 },
                },
            },
            { $match: { recordCount: { $gte: MIN_ACTIVE_RECORDS } } },
            { $sort: { _id: 1 } },
        ])
        .toArray();

    return {
        commodities: commodities
            .map((entry) => ({
                ...entry,
                meta: getCommodityMetadata(entry._id),
            }))
            .filter((entry) => entry.meta?.policyStatus === POLICY_STATUSES.ELIGIBLE_NON_MSP)
            .map((entry) => ({
                category: entry.meta.category,
                id: entry.meta.id,
                label: entry.meta.label,
                labelHi: entry.meta.labelHi,
                policyStatus: entry.meta.policyStatus,
                recordCount: entry.recordCount,
            })),
        state,
    };
}

function normalizeForecastInput(input) {
    const state = validateState(input.state);
    const commodity = validateCommodity(input.commodity);
    if (!input.district) {
        throw badRequest('District is required.');
    }

    return {
        commodity,
        district: String(input.district).trim(),
        farmLocationText: String(input.farmLocationText || '').trim(),
        horizon: Math.max(3, Math.min(14, Math.round(maybeNumber(input.horizon) || 7))),
        marketId: input.marketId ? String(input.marketId).trim() : null,
        quantity: maybeNumber(input.quantity),
        state,
        transportCostPerKm: maybeNumber(input.transportCostPerKm),
    };
}

async function getRecommendation(input) {
    const payload = normalizeForecastInput(input);
    const { candidates, searchScope } = await getCandidatePayload(
        payload.state,
        payload.district,
        payload.commodity,
        payload.marketId,
    );

    const result = await predictMarkets({
        ...payload,
        candidates,
    });

    return {
        ...result,
        commodity: payload.commodity,
        district: payload.district,
        forecastHorizon: payload.horizon,
        searchScope,
        selectedMarketId: payload.marketId,
        state: payload.state,
    };
}

async function getComparison(input) {
    const recommendation = await getRecommendation(input);
    return {
        commodity: recommendation.commodity,
        district: recommendation.district,
        forecastHorizon: recommendation.forecastHorizon,
        model: recommendation.model,
        modelComparison: recommendation.modelComparison,
        searchScope: recommendation.searchScope,
        state: recommendation.state,
        topMarkets: recommendation.topMarkets,
        weatherImpactLabel: recommendation.weatherImpactLabel,
        weatherSummary: recommendation.weatherSummary,
    };
}

async function getMarketDetail(marketId, commodityInput, options = {}) {
    const commodity = validateCommodity(commodityInput);
    const db = await getDb();
    const market = await db.collection('markets').findOne({ _id: marketId });

    if (!market) {
        const error = new Error('Market not found.');
        error.statusCode = 404;
        throw error;
    }

    const [history, weather] = await Promise.all([
        getPriceHistory(db, marketId, commodity, 30),
        getWeatherForMarket(db, market),
    ]);

    if (history.length === 0) {
        throw badRequest('No historical data is available for this market and commodity.');
    }

    const forecast = await forecastMarket({
        commodity,
        district: market.district,
        estimatedDistanceKm: market.estimatedDistanceKm,
        history: serializeHistory(history),
        horizon: Math.max(3, Math.min(14, Math.round(maybeNumber(options.horizon) || 7))),
        marketId: market._id,
        marketName: market.name,
        quantity: maybeNumber(options.quantity),
        state: market.state,
        transportCostPerKm: maybeNumber(options.transportCostPerKm),
        weather,
    });

    await db.collection('forecasts').deleteMany({ commodity, marketId });
    if (forecast.forecast.length > 0) {
        await db.collection('forecasts').insertMany(
            forecast.forecast.map((point) => ({
                ...point,
                commodity,
                generatedAt: new Date().toISOString(),
                marketId,
                modelVersionId:
                    forecast.model?.versionId || `${commodity}-forecast-${forecast.model?.modelName || 'heuristic'}`,
            })),
        );
    }

    const latest = history[history.length - 1];

    return {
        arrivals: buildArrivalSummary(history),
        anomalies: forecast.anomalies,
        commodity,
        confidenceLabel: forecast.confidenceLabel,
        dataSource: buildDataSourceSummary(history),
        forecast: forecast.forecast,
        forecastHorizon: forecast.forecast.length,
        latestPrice: latest.modalPrice,
        market: {
            ...market,
            commodityLabel: getCommodityLabels(commodity).en,
        },
        model: forecast.model || null,
        modelComparison: forecast.modelComparison || [],
        priceHistory: serializeHistory(history),
        profitEstimate: forecast.profitEstimate,
        riskLevel: forecast.riskLevel,
        summary: forecast.summary,
        trendLabel: buildTrendLabel(history),
        weatherImpactLabel: forecast.weatherImpactLabel,
        weatherImpactScore: forecast.weatherImpactScore,
        weatherSummary: forecast.weatherSummary || weather,
    };
}

async function getForecast(marketId, commodityInput, options = {}) {
    const detail = await getMarketDetail(marketId, commodityInput, options);
    return {
        commodity: detail.commodity,
        confidenceLabel: detail.confidenceLabel,
        dataSource: detail.dataSource,
        forecast: detail.forecast,
        forecastHorizon: detail.forecastHorizon,
        marketId,
        model: detail.model,
        modelComparison: detail.modelComparison,
        profitEstimate: detail.profitEstimate,
        riskLevel: detail.riskLevel,
        summary: detail.summary,
        weatherImpactLabel: detail.weatherImpactLabel,
        weatherImpactScore: detail.weatherImpactScore,
        weatherSummary: detail.weatherSummary,
    };
}

async function searchForecasts(input) {
    const payload = normalizeForecastInput(input);
    const comparison = await getRecommendation(payload);
    const primaryMarketId = payload.marketId || comparison.bestMarketId;
    const detail = await getMarketDetail(primaryMarketId, payload.commodity, payload);

    return {
        commodity: payload.commodity,
        comparedMarkets: comparison.topMarkets,
        comparisonSummary: {
            candidateCount: comparison.topMarkets.length,
            searchScope: comparison.searchScope,
        },
        confidenceLabel: detail.confidenceLabel,
        dataSource: detail.dataSource,
        district: payload.district,
        explanation: comparison.explanation,
        forecast: detail.forecast,
        forecastHorizon: detail.forecastHorizon,
        market: detail.market,
        model: detail.model,
        modelComparison: detail.modelComparison,
        priceHistory: detail.priceHistory,
        primaryMarketId,
        primaryMarketName: detail.market.name,
        profitEstimate: detail.profitEstimate,
        riskLevel: detail.riskLevel,
        searchScope: comparison.searchScope,
        state: payload.state,
        summary: detail.summary,
        weatherImpactLabel: detail.weatherImpactLabel,
        weatherImpactScore: detail.weatherImpactScore,
        weatherSummary: detail.weatherSummary,
    };
}

async function createAlert(input) {
    const commodity = validateCommodity(input.commodity);
    const state = validateState(input.state);
    if (!input.district) {
        throw badRequest('District is required for alerts.');
    }
    if (!input.targetPrice) {
        throw badRequest('Target price is required for alerts.');
    }

    const direction =
        String(input.direction || 'above').toLowerCase() === 'below' ? 'below' : 'above';

    const db = await getDb();
    const doc = {
        commodity,
        createdAt: new Date().toISOString(),
        direction,
        district: String(input.district).trim(),
        lastTriggeredAt: null,
        marketId: input.marketId || null,
        state,
        status: 'Active',
        targetPrice: Number(input.targetPrice),
    };

    const result = await db.collection('alerts').insertOne(doc);
    return {
        _id: result.insertedId.toString(),
        ...doc,
    };
}

async function getAlerts() {
    const db = await getDb();
    const alerts = await db.collection('alerts').find({}).sort({ createdAt: -1 }).toArray();

    return alerts.map((alert) => ({
        ...alert,
        _id: alert._id.toString(),
        commodityLabel: getCommodityLabels(alert.commodity).en,
    }));
}

async function getDashboardSummary() {
    const db = await getDb();
    const [
        stateDocs,
        marketCount,
        totalRecordsIngested,
        modelVersions,
        alertsCount,
        weatherSnapshots,
        importRuns,
        importRunTotal,
        weatherHistoryCount,
        sourceBreakdown,
        ingestFilesCount,
        quarantinedFileCount,
        stagedPriceCount,
        stagedWeatherCount,
        quarantineRowCount,
        certificationRuns,
        officialDownloadedFileCount,
        publicStagedFileCount,
        publicWeatherFileCount,
    ] = await Promise.all([
        db.collection('markets').aggregate([
            {
                $group: {
                    _id: '$state',
                    districts: { $addToSet: '$district' },
                    marketCount: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]).toArray(),
        db.collection('markets').countDocuments(),
        db.collection('daily_prices').countDocuments(),
        db.collection('model_versions').find({}).sort({ commodity: 1, modelName: 1 }).toArray(),
        db.collection('alerts').countDocuments(),
        db.collection('weather_snapshots').countDocuments(),
        db.collection('import_runs').find({}).sort({ createdAt: -1 }).limit(5).toArray(),
        db.collection('import_runs').countDocuments(),
        db.collection('weather_history').countDocuments(),
        db.collection('daily_prices').aggregate([
            {
                $group: {
                    _id: '$source',
                    count: { $sum: 1 },
                },
            },
            { $sort: { count: -1, _id: 1 } },
        ]).toArray(),
        db.collection('ingest_files').countDocuments(),
        db.collection('ingest_files').countDocuments({ importStatus: 'quarantined' }),
        db.collection('staging_daily_prices').countDocuments({ approvalStatus: { $ne: 'promoted' } }),
        db.collection('staging_weather_history').countDocuments({ approvalStatus: { $ne: 'promoted' } }),
        db.collection('quarantine_rows').countDocuments(),
        db.collection('certification_runs').find({}).sort({ createdAt: -1 }).limit(1).toArray(),
        db.collection('ingest_files').countDocuments({ sourceType: 'official', status: 'downloaded' }),
        db.collection('ingest_files').countDocuments({ sourceType: 'public_staging', status: 'downloaded' }),
        db.collection('ingest_files').countDocuments({ sourceType: 'public_weather', status: 'downloaded' }),
    ]);

    const activeCommodityIds = await db.collection('daily_prices').distinct('commodity');
    const anomalyCount = await db.collection('forecasts').countDocuments({
        lowerBound: { $exists: true },
    });
    const eligibleCommodityIds = activeCommodityIds.filter(isEligibleCommodity);
    const excludedMspCommodityIds = activeCommodityIds.filter(
        (commodity) => getCommodityPolicy(commodity) === POLICY_STATUSES.EXCLUDED_MSP,
    );

    const demoDataRecordCount = sourceBreakdown
        .filter((entry) => entry._id === 'seed-bootstrap')
        .reduce((sum, entry) => sum + entry.count, 0);
    const realDataRecordCount = sourceBreakdown
        .filter((entry) => entry._id !== 'seed-bootstrap')
        .reduce((sum, entry) => sum + entry.count, 0);
    const approvedPublicRecordCount = await db.collection('daily_prices').countDocuments({
        sourceType: { $in: ['approved_public', 'approved_public_weather'] },
    });
    const officialRecordCount = await db.collection('daily_prices').countDocuments({
        sourceType: 'official',
    });
    const certifiedRecordCount = await db.collection('daily_prices').countDocuments({
        $or: [{ isCertified: true }, { source: 'seed-bootstrap' }],
    });
    const weatherCoverageRecordCount = await db.collection('weather_history').countDocuments({
        $or: [{ isCertified: true }, { source: 'seed-bootstrap' }],
    });

    return {
        activeCommodityCount: eligibleCommodityIds.length,
        alertsCount,
        anomalyCount,
        currentModelVersions: modelVersions
            .filter((model) => isEligibleCommodity(model.commodity))
            .map((model) => ({
                commodity: model.commodity,
                isActive: model.isActive,
                metrics: model.metrics,
                modelName: model.modelName || 'heuristic',
                pipelineHealth: model.pipelineHealth || null,
                status: model.status || 'available',
                taskType: model.taskType,
                trainingData: model.trainingData || null,
                trainedAt: model.trainedAt,
            })),
        approvedPublicRecordCount,
        certifiedRecordCount,
        certificationRunCount: certificationRuns.length > 0 ? 1 : 0,
        demoDataRecordCount,
        downloadedFileCount: ingestFilesCount,
        eligibleNonMspCommodityCount: eligibleCommodityIds.length,
        excludedMspCommodityCount: excludedMspCommodityIds.length,
        importRunCount: importRunTotal,
        marketCount,
        officialRecordCount,
        officialDownloadedFileCount,
        publicStagedFileCount,
        publicWeatherFileCount,
        quarantineRowCount,
        quarantinedFileCount,
        recentImports: importRuns.map((run) => ({
            commodities: run.commodities || [],
            createdAt: run.createdAt,
            eligibleNonMspRows: run.eligibleNonMspRows || 0,
            excludedMspRows: run.excludedMspRows || 0,
            importedWeatherRows: run.importedWeatherRows || 0,
            insertedRows: run.insertedRows || 0,
            sourceName: run.sourceName,
            states: run.states || [],
            updatedRows: run.updatedRows || 0,
        })),
        realDataRecordCount,
        sourceBreakdown: sourceBreakdown.map((entry) => ({
            count: entry.count,
            source: entry._id || 'unknown',
        })),
        stagedPriceCount,
        stagedWeatherCount,
        states: stateDocs.map((entry) => ({
            districtCount: entry.districts.length,
            marketCount: entry.marketCount,
            state: entry._id,
        })),
        supportedStateCount: stateDocs.length,
        totalRecordsIngested,
        weatherHistoryCount,
        weatherSnapshotCount: weatherSnapshots,
    };
}

module.exports = {
    createAlert,
    getAlerts,
    getComparison,
    getCommodities,
    getDashboardSummary,
    getDistricts,
    getForecast,
    getMarketDetail,
    getMarkets,
    getRecommendation,
    getStates,
    searchForecasts,
};
