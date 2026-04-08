const { getDb } = require('../config/mongo');
const { forecastMarket, predictMarkets } = require('./modelClient');
const { getWeatherForMarket } = require('./weatherService');
const { getCommodityLabels, normalizeCommodity, normalizeState } = require('../utils/normalizers');

const MIN_ACTIVE_RECORDS = 10;

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
        throw badRequest('Unsupported state. Choose Madhya Pradesh or Chhattisgarh.');
    }
    return state;
}

function validateCommodity(value) {
    const commodity = normalizeCommodity(value);
    if (!commodity) {
        throw badRequest('Unsupported commodity.');
    }
    return commodity;
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

async function buildCandidate(db, market, commodity) {
    const [history, weather] = await Promise.all([
        getPriceHistory(db, market._id, commodity, 24),
        getWeatherForMarket(db, market),
    ]);

    if (history.length < MIN_ACTIVE_RECORDS) {
        return null;
    }

    return {
        district: market.district,
        estimatedDistanceKm: market.estimatedDistanceKm || 24,
        history: serializeHistory(history),
        marketId: market._id,
        marketName: market.name,
        state: market.state,
        weather,
    };
}

async function getCandidatePayload(state, district, commodity) {
    const db = await getDb();
    let searchScope = 'district';
    let markets = await db
        .collection('markets')
        .find({ commodities: commodity, district, state })
        .sort({ name: 1 })
        .toArray();

    if (markets.length === 0) {
        searchScope = 'state';
        markets = await db
            .collection('markets')
            .find({ commodities: commodity, state })
            .sort({ name: 1 })
            .toArray();
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
    const states = await db.collection('markets').distinct('state');
    return states.sort();
}

async function getDistricts(stateInput) {
    const state = validateState(stateInput);
    const db = await getDb();
    const districts = await db.collection('markets').distinct('district', { state });
    return { districts: districts.sort(), state };
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
        commodities: commodities.map((entry) => {
            const labels = getCommodityLabels(entry._id);
            return {
                id: entry._id,
                label: labels.en,
                labelHi: labels.hi,
                recordCount: entry.recordCount,
            };
        }),
        state,
    };
}

function normalizeRecommendationInput(input) {
    const state = validateState(input.state);
    const commodity = validateCommodity(input.commodity);
    if (!input.district) {
        throw badRequest('District is required.');
    }

    return {
        commodity,
        district: String(input.district).trim(),
        farmLocationText: String(input.farmLocationText || '').trim(),
        quantity: maybeNumber(input.quantity),
        state,
        transportCostPerKm: maybeNumber(input.transportCostPerKm),
    };
}

async function getRecommendation(input) {
    const payload = normalizeRecommendationInput(input);
    const { candidates, searchScope } = await getCandidatePayload(
        payload.state,
        payload.district,
        payload.commodity,
    );

    const result = await predictMarkets({
        ...payload,
        candidates,
    });

    return {
        ...result,
        commodity: payload.commodity,
        district: payload.district,
        searchScope,
        state: payload.state,
    };
}

async function getComparison(input) {
    const recommendation = await getRecommendation(input);
    return {
        commodity: recommendation.commodity,
        district: recommendation.district,
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
                modelVersionId: `${commodity}-forecast-v2`,
            })),
        );
    }

    const latest = history[history.length - 1];

    return {
        arrivals: buildArrivalSummary(history),
        anomalies: forecast.anomalies,
        commodity,
        confidenceLabel: forecast.confidenceLabel,
        forecast: forecast.forecast,
        latestPrice: latest.modalPrice,
        market: {
            ...market,
            commodityLabel: getCommodityLabels(commodity).en,
        },
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
        forecast: detail.forecast,
        marketId,
        profitEstimate: detail.profitEstimate,
        riskLevel: detail.riskLevel,
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
    const [stateDocs, marketCount, totalRecordsIngested, activeModels, alertsCount, weatherSnapshots] =
        await Promise.all([
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
            db.collection('model_versions').find({ isActive: true }).sort({ commodity: 1 }).toArray(),
            db.collection('alerts').countDocuments(),
            db.collection('weather_snapshots').countDocuments(),
        ]);

    const activeCommodityIds = await db.collection('daily_prices').distinct('commodity');
    const anomalyCount = await db.collection('forecasts').countDocuments({
        lowerBound: { $exists: true },
    });

    return {
        activeCommodityCount: activeCommodityIds.length,
        alertsCount,
        anomalyCount,
        currentModelVersions: activeModels.map((model) => ({
            commodity: model.commodity,
            metrics: model.metrics,
            taskType: model.taskType,
            trainedAt: model.trainedAt,
        })),
        marketCount,
        states: stateDocs.map((entry) => ({
            districtCount: entry.districts.length,
            marketCount: entry.marketCount,
            state: entry._id,
        })),
        supportedStateCount: stateDocs.length,
        totalRecordsIngested,
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
    getRecommendation,
    getStates,
};
