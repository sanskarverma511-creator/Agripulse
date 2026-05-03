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
    // Madhya Pradesh
    buildMarketSeedEntry('mp', 'BPL', 1, 'Madhya Pradesh', 'Bhopal', 'Bhopal Krishi Upaj Mandi', 23.2599, 77.4126, 18, 45),
    buildMarketSeedEntry('mp', 'SEH', 1, 'Madhya Pradesh', 'Sehore', 'Sehore Agri Trade Yard', 23.2038, 77.0844, 31, 58),
    buildMarketSeedEntry('mp', 'VID', 1, 'Madhya Pradesh', 'Vidisha', 'Vidisha Produce Market', 23.5236, 77.8061, 27, 39),
    buildMarketSeedEntry('mp', 'IDR', 1, 'Madhya Pradesh', 'Indore', 'Indore Chhawani Mandi', 22.7196, 75.8577, 22, 130),
    buildMarketSeedEntry('mp', 'UJN', 1, 'Madhya Pradesh', 'Ujjain', 'Ujjain Grain and Veg Market', 23.1765, 75.7885, 29, 64),
    buildMarketSeedEntry('mp', 'DWS', 1, 'Madhya Pradesh', 'Dewas', 'Dewas Kisan Mandi', 22.9659, 76.0553, 26, 54),
    buildMarketSeedEntry('mp', 'GWL', 1, 'Madhya Pradesh', 'Gwalior', 'Gwalior Lashkar Mandi', 26.2183, 78.1828, 33, 77),
    buildMarketSeedEntry('mp', 'JBP', 1, 'Madhya Pradesh', 'Jabalpur', 'Jabalpur Adhartal Agri Yard', 23.1815, 79.9864, 30, 68),

    // Chhattisgarh
    buildMarketSeedEntry('cg', 'RPR', 1, 'Chhattisgarh', 'Raipur', 'Raipur Kisan Bazaar', 21.2514, 81.6296, 20, 60),
    buildMarketSeedEntry('cg', 'DRG', 1, 'Chhattisgarh', 'Durg', 'Durg Krishi Mandi', 21.1904, 81.2849, 19, 10),
    buildMarketSeedEntry('cg', 'BSP', 1, 'Chhattisgarh', 'Bilaspur', 'Bilaspur Krishi Upaj Market', 22.0797, 82.1409, 28, 48),
    buildMarketSeedEntry('cg', 'KRB', 1, 'Chhattisgarh', 'Korba', 'Korba Fresh Produce Yard', 22.3595, 82.7501, 34, 37),
    buildMarketSeedEntry('cg', 'RJN', 1, 'Chhattisgarh', 'Rajnandgaon', 'Rajnandgaon Farmer Mandi', 21.0974, 81.0337, 24, 29),
    buildMarketSeedEntry('cg', 'JDP', 1, 'Chhattisgarh', 'Jagdalpur', 'Jagdalpur Tribal Produce Market', 19.0748, 82.0080, 36, 56),
    buildMarketSeedEntry('cg', 'DMT', 1, 'Chhattisgarh', 'Dhamtari', 'Dhamtari Paddy and Veg Yard', 20.7074, 81.5497, 22, 31),
    buildMarketSeedEntry('cg', 'MHS', 1, 'Chhattisgarh', 'Mahasamund', 'Mahasamund Kisan Trade Hub', 21.1097, 82.0971, 27, 34),

    // Maharashtra
    buildMarketSeedEntry('mh', 'PUN', 1, 'Maharashtra', 'Pune', 'Pune Central Mandi', 18.5204, 73.8567, 15, 80),
    buildMarketSeedEntry('mh', 'NSK', 1, 'Maharashtra', 'Nashik', 'Nashik Onion Trading Yard', 19.9975, 73.7898, 25, 95),
    buildMarketSeedEntry('mh', 'NAG', 1, 'Maharashtra', 'Nagpur', 'Nagpur Orange and Grain Market', 21.1458, 79.0882, 30, 40),
    buildMarketSeedEntry('mh', 'AUR', 1, 'Maharashtra', 'Aurangabad', 'Aurangabad Krishi Bazaar', 19.8762, 75.3433, 22, 55),
    buildMarketSeedEntry('mh', 'SOL', 1, 'Maharashtra', 'Solapur', 'Solapur Pulse Exchange', 17.6599, 75.9064, 35, 65),
    buildMarketSeedEntry('mh', 'AMR', 1, 'Maharashtra', 'Amravati', 'Amravati Cotton and Grain Yard', 20.9320, 77.7523, 28, 50),
    buildMarketSeedEntry('mh', 'KOL', 1, 'Maharashtra', 'Kolhapur', 'Kolhapur Sugarcane Market', 16.7050, 74.2433, 20, 70),
    buildMarketSeedEntry('mh', 'SAT', 1, 'Maharashtra', 'Satara', 'Satara Local Farmer Market', 17.6805, 73.9803, 32, 45),

    // Rajasthan
    buildMarketSeedEntry('rj', 'JPR', 1, 'Rajasthan', 'Jaipur', 'Jaipur Muhana Mandi', 26.9124, 75.7873, 12, 60),
    buildMarketSeedEntry('rj', 'JDH', 1, 'Rajasthan', 'Jodhpur', 'Jodhpur Grain Market', 26.2389, 73.0243, 20, 50),
    buildMarketSeedEntry('rj', 'KOT', 1, 'Rajasthan', 'Kota', 'Kota Bhamashah Mandi', 25.2138, 75.8648, 18, 75),
    buildMarketSeedEntry('rj', 'BKN', 1, 'Rajasthan', 'Bikaner', 'Bikaner Wool and Grain Yard', 28.0229, 73.3119, 28, 40),
    buildMarketSeedEntry('rj', 'AJM', 1, 'Rajasthan', 'Ajmer', 'Ajmer Produce Exchange', 26.4499, 74.6399, 24, 55),
    buildMarketSeedEntry('rj', 'UDP', 1, 'Rajasthan', 'Udaipur', 'Udaipur Krishi Upaj Mandi', 24.5854, 73.7125, 30, 45),
    buildMarketSeedEntry('rj', 'ALW', 1, 'Rajasthan', 'Alwar', 'Alwar Mustard and Wheat Yard', 27.5530, 76.6346, 22, 85),
    buildMarketSeedEntry('rj', 'SGR', 1, 'Rajasthan', 'Sri Ganganagar', 'Ganganagar Grain Market', 29.9038, 73.8772, 35, 90),

    // Uttar Pradesh
    buildMarketSeedEntry('up', 'LKO', 1, 'Uttar Pradesh', 'Lucknow', 'Lucknow Naveen Galla Mandi', 26.8467, 80.9462, 10, 50),
    buildMarketSeedEntry('up', 'KNP', 1, 'Uttar Pradesh', 'Kanpur', 'Kanpur Chakarpur Mandi', 26.4499, 80.3319, 15, 65),
    buildMarketSeedEntry('up', 'VNS', 1, 'Uttar Pradesh', 'Varanasi', 'Varanasi Pahariya Mandi', 25.3176, 82.9739, 20, 70),
    buildMarketSeedEntry('up', 'AGR', 1, 'Uttar Pradesh', 'Agra', 'Agra Etmadpur Mandi', 27.1767, 78.0081, 18, 60),
    buildMarketSeedEntry('up', 'MRT', 1, 'Uttar Pradesh', 'Meerut', 'Meerut Galla Mandi', 28.9845, 77.7064, 25, 80),
    buildMarketSeedEntry('up', 'GZB', 1, 'Uttar Pradesh', 'Ghaziabad', 'Ghaziabad Sahibabad Mandi', 28.6692, 77.4538, 12, 110),
    buildMarketSeedEntry('up', 'BRY', 1, 'Uttar Pradesh', 'Bareilly', 'Bareilly Delapeer Mandi', 28.3670, 79.4304, 22, 45),
    buildMarketSeedEntry('up', 'GKP', 1, 'Uttar Pradesh', 'Gorakhpur', 'Gorakhpur Mahewa Mandi', 26.7606, 83.3731, 30, 40),
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
    const ALL_STATES = [...new Set(MARKET_SEED.map(m => m.state))];
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
                states: ALL_STATES,
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
                states: ALL_STATES,
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
