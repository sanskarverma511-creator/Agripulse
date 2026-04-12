const { getCommodityLabels } = require('../utils/normalizers');

const COMMON_CROPS = ['wheat', 'soybean', 'onion', 'paddy', 'tomato', 'potato', 'maize', 'gram', 'sugarcane'];

function buildMarketSeedEntry(prefix, districtCode, serial, state, district, name, lat, lon, estimatedDistanceKm, priceBias) {
    return {
        _id: `${prefix}-${district.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(serial).padStart(3, '0')}`,
        code: `${prefix.toUpperCase()}-${districtCode}-${String(serial).padStart(3, '0')}`,
        commodities: COMMON_CROPS,
        district,
        estimatedDistanceKm,
        lat,
        lon,
        name,
        priceBias,
        state,
        status: 'Active',
    };
}

const MARKET_SEED = [
    buildMarketSeedEntry('mp', 'BPL', 1, 'Madhya Pradesh', 'Bhopal', 'Bhopal Krishi Upaj Mandi', 23.2599, 77.4126, 18, 45),
    buildMarketSeedEntry('mp', 'BPL', 2, 'Madhya Pradesh', 'Bhopal', 'Karond Farmer Market', 23.2815, 77.4011, 24, 85),
    buildMarketSeedEntry('mp', 'SEH', 1, 'Madhya Pradesh', 'Sehore', 'Sehore Agri Trade Yard', 23.2038, 77.0844, 31, 58),
    buildMarketSeedEntry('mp', 'VID', 1, 'Madhya Pradesh', 'Vidisha', 'Vidisha Produce Market', 23.5236, 77.8061, 27, 39),
    buildMarketSeedEntry('mp', 'IDR', 1, 'Madhya Pradesh', 'Indore', 'Indore Chhawani Mandi', 22.7196, 75.8577, 22, 130),
    buildMarketSeedEntry('mp', 'IDR', 2, 'Madhya Pradesh', 'Indore', 'Lasudia Produce Exchange', 22.7521, 75.9027, 28, 70),
    buildMarketSeedEntry('mp', 'UJN', 1, 'Madhya Pradesh', 'Ujjain', 'Ujjain Grain and Veg Market', 23.1765, 75.7885, 29, 64),
    buildMarketSeedEntry('mp', 'DWS', 1, 'Madhya Pradesh', 'Dewas', 'Dewas Kisan Mandi', 22.9659, 76.0553, 26, 54),
    buildMarketSeedEntry('mp', 'GWL', 1, 'Madhya Pradesh', 'Gwalior', 'Gwalior Lashkar Mandi', 26.2183, 78.1828, 33, 77),
    buildMarketSeedEntry('mp', 'JBP', 1, 'Madhya Pradesh', 'Jabalpur', 'Jabalpur Adhartal Agri Yard', 23.1815, 79.9864, 30, 68),
    buildMarketSeedEntry('cg', 'RPR', 1, 'Chhattisgarh', 'Raipur', 'Raipur Kisan Bazaar', 21.2514, 81.6296, 20, 60),
    buildMarketSeedEntry('cg', 'RPR', 2, 'Chhattisgarh', 'Raipur', 'Abhanpur Agri Yard', 21.0522, 81.7456, 33, 25),
    buildMarketSeedEntry('cg', 'DRG', 1, 'Chhattisgarh', 'Durg', 'Durg Krishi Mandi', 21.1904, 81.2849, 19, 10),
    buildMarketSeedEntry('cg', 'DRG', 2, 'Chhattisgarh', 'Durg', 'Bhilai Produce Hub', 21.1938, 81.3509, 26, 42),
    buildMarketSeedEntry('cg', 'BSP', 1, 'Chhattisgarh', 'Bilaspur', 'Bilaspur Krishi Upaj Market', 22.0797, 82.1409, 28, 48),
    buildMarketSeedEntry('cg', 'KRB', 1, 'Chhattisgarh', 'Korba', 'Korba Fresh Produce Yard', 22.3595, 82.7501, 34, 37),
    buildMarketSeedEntry('cg', 'RJN', 1, 'Chhattisgarh', 'Rajnandgaon', 'Rajnandgaon Farmer Mandi', 21.0974, 81.0337, 24, 29),
    buildMarketSeedEntry('cg', 'JDP', 1, 'Chhattisgarh', 'Jagdalpur', 'Jagdalpur Tribal Produce Market', 19.0748, 82.0080, 36, 56),
    buildMarketSeedEntry('cg', 'DMT', 1, 'Chhattisgarh', 'Dhamtari', 'Dhamtari Paddy and Veg Yard', 20.7074, 81.5497, 22, 31),
    buildMarketSeedEntry('cg', 'MHS', 1, 'Chhattisgarh', 'Mahasamund', 'Mahasamund Kisan Trade Hub', 21.1097, 82.0971, 27, 34),
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
