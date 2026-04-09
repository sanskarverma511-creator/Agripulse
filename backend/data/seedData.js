const { getCommodityLabels } = require('../utils/normalizers');

const COMMON_CROPS = ['wheat', 'soybean', 'onion', 'paddy', 'tomato', 'potato', 'maize', 'gram', 'sugarcane'];

const MARKET_SEED = [
    {
        _id: 'mp-bhopal-001',
        code: 'MP-BPL-001',
        commodities: COMMON_CROPS,
        district: 'Bhopal',
        estimatedDistanceKm: 18,
        lat: 23.2599,
        lon: 77.4126,
        name: 'Bhopal Krishi Upaj Mandi',
        priceBias: 45,
        state: 'Madhya Pradesh',
        status: 'Active',
    },
    {
        _id: 'mp-bhopal-002',
        code: 'MP-BPL-002',
        commodities: COMMON_CROPS,
        district: 'Bhopal',
        estimatedDistanceKm: 24,
        lat: 23.2815,
        lon: 77.4011,
        name: 'Karond Farmer Market',
        priceBias: 85,
        state: 'Madhya Pradesh',
        status: 'Active',
    },
    {
        _id: 'mp-indore-001',
        code: 'MP-IDR-001',
        commodities: COMMON_CROPS,
        district: 'Indore',
        estimatedDistanceKm: 22,
        lat: 22.7196,
        lon: 75.8577,
        name: 'Indore Chhawani Mandi',
        priceBias: 130,
        state: 'Madhya Pradesh',
        status: 'Active',
    },
    {
        _id: 'mp-indore-002',
        code: 'MP-IDR-002',
        commodities: COMMON_CROPS,
        district: 'Indore',
        estimatedDistanceKm: 28,
        lat: 22.7521,
        lon: 75.9027,
        name: 'Lasudia Produce Exchange',
        priceBias: 70,
        state: 'Madhya Pradesh',
        status: 'Active',
    },
    {
        _id: 'cg-raipur-001',
        code: 'CG-RPR-001',
        commodities: COMMON_CROPS,
        district: 'Raipur',
        estimatedDistanceKm: 20,
        lat: 21.2514,
        lon: 81.6296,
        name: 'Raipur Kisan Bazaar',
        priceBias: 60,
        state: 'Chhattisgarh',
        status: 'Active',
    },
    {
        _id: 'cg-raipur-002',
        code: 'CG-RPR-002',
        commodities: COMMON_CROPS,
        district: 'Raipur',
        estimatedDistanceKm: 33,
        lat: 21.0522,
        lon: 81.7456,
        name: 'Abhanpur Agri Yard',
        priceBias: 25,
        state: 'Chhattisgarh',
        status: 'Active',
    },
    {
        _id: 'cg-durg-001',
        code: 'CG-DRG-001',
        commodities: COMMON_CROPS,
        district: 'Durg',
        estimatedDistanceKm: 19,
        lat: 21.1904,
        lon: 81.2849,
        name: 'Durg Krishi Mandi',
        priceBias: 10,
        state: 'Chhattisgarh',
        status: 'Active',
    },
    {
        _id: 'cg-durg-002',
        code: 'CG-DRG-002',
        commodities: COMMON_CROPS,
        district: 'Durg',
        estimatedDistanceKm: 26,
        lat: 21.1938,
        lon: 81.3509,
        name: 'Bhilai Produce Hub',
        priceBias: 42,
        state: 'Chhattisgarh',
        status: 'Active',
    },
];

const COMMODITY_CONFIG = {
    gram: { arrivalBase: 320, basePrice: 5380, spread: 110, slope: 22 },
    maize: { arrivalBase: 470, basePrice: 2190, spread: 78, slope: 16 },
    onion: { arrivalBase: 520, basePrice: 1880, spread: 95, slope: 24 },
    paddy: { arrivalBase: 640, basePrice: 2220, spread: 80, slope: 18 },
    potato: { arrivalBase: 560, basePrice: 1720, spread: 88, slope: 19 },
    soybean: { arrivalBase: 390, basePrice: 4470, spread: 120, slope: 28 },
    tomato: { arrivalBase: 610, basePrice: 1640, spread: 140, slope: 26 },
    wheat: { arrivalBase: 440, basePrice: 2650, spread: 85, slope: 20 },
    sugarcane: { arrivalBase: 800, basePrice: 480, spread: 40, slope: 5 },
};

function buildPriceDocs(days = 90) {
    const today = new Date(Date.UTC(2026, 3, 2));
    const docs = [];

    for (const market of MARKET_SEED) {
        for (const commodity of market.commodities) {
            const config = COMMODITY_CONFIG[commodity];
            for (let offset = days - 1; offset >= 0; offset -= 1) {
                const day = new Date(today);
                day.setUTCDate(today.getUTCDate() - offset);
                const isoDate = day.toISOString().slice(0, 10);
                const step = days - offset;
                const weeklyWave = ((step % 5) - 2) * 9;
                const seasonalWave = Math.round(Math.sin(step / 3) * (config.spread / 3));
                const stateLift = market.state === 'Madhya Pradesh' ? 35 : -18;
                const modalPrice =
                    config.basePrice +
                    market.priceBias +
                    stateLift +
                    step * config.slope +
                    weeklyWave +
                    seasonalWave;
                const minPrice = modalPrice - config.spread;
                const maxPrice = modalPrice + Math.round(config.spread * 1.2);
                const arrivalQty =
                    config.arrivalBase +
                    ((step % 4) * 22) +
                    Math.round(Math.cos(step / 4) * 18) +
                    Math.round(market.priceBias / 8);

                docs.push({
                    _id: `${market._id}-${commodity}-${isoDate}`,
                    arrivalQty: Math.max(arrivalQty, 70),
                    commodity,
                    date: isoDate,
                    district: market.district,
                    ingestedAt: new Date().toISOString(),
                    marketId: market._id,
                    maxPrice,
                    minPrice,
                    modalPrice,
                    source: 'seed-bootstrap',
                    state: market.state,
                });
            }
        }
    }

    return docs;
}

function buildModelVersions() {
    return Object.keys(COMMODITY_CONFIG).flatMap((commodity, index) => {
        const labels = getCommodityLabels(commodity);
        return [
            {
                _id: `${commodity}-recommendation-v2`,
                artifactPath: `builtin:${commodity}:recommendation:v2`,
                commodity,
                commodityLabel: labels.en,
                isActive: true,
                metrics: {
                    mape: 5.8 + index * 0.4,
                    rmse: 72 + index * 6,
                },
                states: ['Madhya Pradesh', 'Chhattisgarh'],
                taskType: 'recommendation',
                trainedAt: '2026-04-03T09:00:00.000Z',
            },
            {
                _id: `${commodity}-forecast-v2`,
                artifactPath: `builtin:${commodity}:forecast:v2`,
                commodity,
                commodityLabel: labels.en,
                isActive: true,
                metrics: {
                    mape: 6.9 + index * 0.5,
                    rmse: 81 + index * 7,
                },
                states: ['Madhya Pradesh', 'Chhattisgarh'],
                taskType: 'forecast',
                trainedAt: '2026-04-03T09:30:00.000Z',
            },
        ];
    });
}

function getSeedPayload() {
    const createdAt = new Date().toISOString();

    return {
        markets: MARKET_SEED.map((market) => ({
            ...market,
            createdAt,
            updatedAt: createdAt,
        })),
        modelVersions: buildModelVersions(),
        prices: buildPriceDocs(),
    };
}

module.exports = {
    COMMON_CROPS,
    getSeedPayload,
};
