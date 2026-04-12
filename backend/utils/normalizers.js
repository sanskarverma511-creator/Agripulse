const POLICY_STATUSES = {
    ELIGIBLE_NON_MSP: 'eligible_non_msp',
    EXCLUDED_MANUAL: 'excluded_manual',
    EXCLUDED_MSP: 'excluded_msp',
};

const STATE_ALIASES = {
    cg: 'Chhattisgarh',
    chattisgarh: 'Chhattisgarh',
    chhattisgarh: 'Chhattisgarh',
    ct: 'Chhattisgarh',
    'madhya pradesh': 'Madhya Pradesh',
    madhyapradesh: 'Madhya Pradesh',
    mp: 'Madhya Pradesh',
};

const COMMODITY_ALIASES = {
    apple: 'apple',
    arhar: 'tur',
    banana: 'banana',
    barley: 'barley',
    bajra: 'bajra',
    bean: 'beans',
    beans: 'beans',
    bhindi: 'okra',
    brinjal: 'brinjal',
    cabbage: 'cabbage',
    capsicum: 'capsicum',
    carrot: 'carrot',
    cashewnut: 'cashew',
    cauliflower: 'cauliflower',
    chana: 'gram',
    chickpea: 'gram',
    chilli: 'green-chilli',
    coconut: 'de-husked-coconut',
    coffee: 'coffee',
    copra: 'copra',
    corn: 'maize',
    cotton: 'cotton',
    cucumber: 'cucumber',
    cumin: 'cumin',
    dhan: 'paddy',
    drychilli: 'dry-chilli',
    drymirchi: 'dry-chilli',
    garlic: 'garlic',
    genda: 'marigold',
    ginger: 'ginger',
    gram: 'gram',
    grapes: 'grapes',
    greenchilli: 'green-chilli',
    greenpea: 'green-peas',
    greenpeas: 'green-peas',
    groundnut: 'groundnut',
    guar: 'cluster-beans',
    guava: 'guava',
    jowar: 'jowar',
    jute: 'jute',
    kinnow: 'kinnow',
    ladysfinger: 'okra',
    lemon: 'lemon',
    lentil: 'masur',
    maize: 'maize',
    makka: 'maize',
    mango: 'mango',
    marigold: 'marigold',
    masoor: 'masur',
    masur: 'masur',
    moong: 'moong',
    mosambi: 'sweet-lime',
    mustard: 'rapeseed-mustard',
    nigerseed: 'nigerseed',
    okra: 'okra',
    onion: 'onion',
    orange: 'orange',
    papaya: 'papaya',
    paddy: 'paddy',
    pea: 'green-peas',
    peas: 'green-peas',
    potato: 'potato',
    pomegranate: 'pomegranate',
    '\u092a\u094d\u092f\u093e\u091c': 'onion',
    radish: 'radish',
    ragi: 'ragi',
    rajma: 'rajma',
    rapeseedmustard: 'rapeseed-mustard',
    redgram: 'tur',
    rice: 'paddy',
    rose: 'rose',
    safflower: 'safflower',
    sarson: 'rapeseed-mustard',
    sesamum: 'sesamum',
    '\u0938\u094b\u092f\u093e\u092c\u0940\u0928': 'soybean',
    soybean: 'soybean',
    soyabean: 'soybean',
    spinach: 'spinach',
    sugarcane: 'sugarcane',
    sunflower: 'sunflower-seed',
    sunflowerseed: 'sunflower-seed',
    sweetlime: 'sweet-lime',
    tamatar: 'tomato',
    tea: 'tea',
    tomato: 'tomato',
    toria: 'toria',
    tur: 'tur',
    turmeric: 'turmeric',
    urad: 'urad',
    watermelon: 'watermelon',
    wheat: 'wheat',
};

const COMMODITY_LABELS = {
    apple: { en: 'Apple', hi: '\u0938\u0947\u092c' },
    banana: { en: 'Banana', hi: '\u0915\u0947\u0932\u093e' },
    barley: { en: 'Barley', hi: '\u091c\u094c' },
    bajra: { en: 'Bajra', hi: '\u092c\u093e\u091c\u0930\u093e' },
    beans: { en: 'Beans', hi: '\u092c\u0940\u0928\u094d\u0938' },
    brinjal: { en: 'Brinjal', hi: '\u092c\u0948\u0902\u0917\u0928' },
    cabbage: { en: 'Cabbage', hi: '\u092a\u0924\u094d\u0924\u093e \u0917\u094b\u092d\u0940' },
    capsicum: { en: 'Capsicum', hi: '\u0936\u093f\u092e\u0932\u093e \u092e\u093f\u0930\u094d\u091a' },
    carrot: { en: 'Carrot', hi: '\u0917\u093e\u091c\u0930' },
    cashew: { en: 'Cashew', hi: '\u0915\u093e\u091c\u0942' },
    cauliflower: { en: 'Cauliflower', hi: '\u092b\u0942\u0932\u0917\u094b\u092d\u0940' },
    'cluster-beans': { en: 'Cluster Beans', hi: '\u0917\u094d\u0935\u093e\u0930 \u092b\u0932\u0940' },
    coffee: { en: 'Coffee', hi: '\u0915\u0949\u092b\u0940' },
    copra: { en: 'Copra', hi: '\u0917\u094b\u0932\u093e' },
    cotton: { en: 'Cotton', hi: '\u0915\u092a\u093e\u0938' },
    cucumber: { en: 'Cucumber', hi: '\u0916\u0940\u0930\u093e' },
    cumin: { en: 'Cumin', hi: '\u091c\u0940\u0930\u093e' },
    'de-husked-coconut': { en: 'De-husked Coconut', hi: '\u091b\u093f\u0932\u093e \u0928\u093e\u0930\u093f\u092f\u0932' },
    'dry-chilli': { en: 'Dry Chilli', hi: '\u0938\u0942\u0916\u0940 \u092e\u093f\u0930\u094d\u091a' },
    garlic: { en: 'Garlic', hi: '\u0932\u0939\u0938\u0941\u0928' },
    gram: { en: 'Gram', hi: '\u091a\u0928\u093e' },
    grapes: { en: 'Grapes', hi: '\u0905\u0902\u0917\u0942\u0930' },
    'green-chilli': { en: 'Green Chilli', hi: '\u0939\u0930\u0940 \u092e\u093f\u0930\u094d\u091a' },
    'green-peas': { en: 'Green Peas', hi: '\u0939\u0930\u0940 \u092e\u091f\u0930' },
    groundnut: { en: 'Groundnut', hi: '\u092e\u0942\u0902\u0917\u092b\u0932\u0940' },
    guava: { en: 'Guava', hi: '\u0905\u092e\u0930\u0942\u0926' },
    jowar: { en: 'Jowar', hi: '\u091c\u094d\u0935\u093e\u0930' },
    jute: { en: 'Jute', hi: '\u091c\u0942\u091f' },
    kinnow: { en: 'Kinnow', hi: '\u0915\u093f\u0928\u094d\u0928\u0942' },
    lemon: { en: 'Lemon', hi: '\u0928\u0940\u0902\u092c\u0942' },
    maize: { en: 'Maize', hi: '\u092e\u0915\u094d\u0915\u093e' },
    mango: { en: 'Mango', hi: '\u0906\u092e' },
    marigold: { en: 'Marigold', hi: '\u0917\u0947\u0902\u0926\u093e' },
    masur: { en: 'Masur', hi: '\u092e\u0938\u0942\u0930' },
    moong: { en: 'Moong', hi: '\u092e\u0942\u0902\u0917' },
    nigerseed: { en: 'Nigerseed', hi: '\u0930\u093e\u092e\u0924\u093f\u0932' },
    okra: { en: 'Okra', hi: '\u092d\u093f\u0902\u0921\u0940' },
    onion: { en: 'Onion', hi: '\u092a\u094d\u092f\u093e\u091c' },
    orange: { en: 'Orange', hi: '\u0938\u0902\u0924\u0930\u093e' },
    papaya: { en: 'Papaya', hi: '\u092a\u092a\u0940\u0924\u093e' },
    paddy: { en: 'Paddy', hi: '\u0927\u093e\u0928' },
    potato: { en: 'Potato', hi: '\u0906\u0932\u0942' },
    pomegranate: { en: 'Pomegranate', hi: '\u0905\u0928\u093e\u0930' },
    radish: { en: 'Radish', hi: '\u092e\u0942\u0932\u0940' },
    ragi: { en: 'Ragi', hi: '\u0930\u093e\u0917\u0940' },
    rajma: { en: 'Rajma', hi: '\u0930\u093e\u091c\u092e\u093e' },
    'rapeseed-mustard': { en: 'Rapeseed Mustard', hi: '\u0938\u0930\u0938\u094b\u0902' },
    rose: { en: 'Rose', hi: '\u0917\u0941\u0932\u093e\u092c' },
    safflower: { en: 'Safflower', hi: '\u0915\u0941\u0938\u0941\u092e' },
    sesamum: { en: 'Sesamum', hi: '\u0924\u093f\u0932' },
    soybean: { en: 'Soybean', hi: '\u0938\u094b\u092f\u093e\u092c\u0940\u0928' },
    spinach: { en: 'Spinach', hi: '\u092a\u093e\u0932\u0915' },
    sugarcane: { en: 'Sugarcane', hi: '\u0917\u0928\u094d\u0928\u093e' },
    'sunflower-seed': { en: 'Sunflower Seed', hi: '\u0938\u0942\u0930\u091c\u092e\u0941\u0916\u0940 \u092c\u0940\u091c' },
    'sweet-lime': { en: 'Sweet Lime', hi: '\u092e\u094c\u0938\u0902\u092c\u0940' },
    tea: { en: 'Tea', hi: '\u091a\u093e\u092f' },
    tomato: { en: 'Tomato', hi: '\u091f\u092e\u093e\u091f\u0930' },
    toria: { en: 'Toria', hi: '\u0924\u094b\u0930\u093f\u092f\u093e' },
    tur: { en: 'Tur', hi: '\u0905\u0930\u0939\u0930' },
    turmeric: { en: 'Turmeric', hi: '\u0939\u0932\u094d\u0926\u0940' },
    urad: { en: 'Urad', hi: '\u0909\u095c\u0926' },
    watermelon: { en: 'Watermelon', hi: '\u0924\u0930\u092c\u0942\u091c' },
    wheat: { en: 'Wheat', hi: '\u0917\u0947\u0939\u0942\u0901' },
};

const CATEGORY_BY_COMMODITY = {
    apple: 'fruit',
    banana: 'fruit',
    barley: 'grain',
    bajra: 'grain',
    beans: 'vegetable',
    brinjal: 'vegetable',
    cabbage: 'vegetable',
    capsicum: 'vegetable',
    carrot: 'vegetable',
    cashew: 'plantation',
    cauliflower: 'vegetable',
    'cluster-beans': 'vegetable',
    coffee: 'plantation',
    copra: 'commercial',
    cotton: 'commercial',
    cucumber: 'vegetable',
    cumin: 'spice',
    'de-husked-coconut': 'plantation',
    'dry-chilli': 'spice',
    garlic: 'spice',
    gram: 'pulse',
    grapes: 'fruit',
    'green-chilli': 'vegetable',
    'green-peas': 'pulse',
    groundnut: 'oilseed',
    guava: 'fruit',
    jowar: 'grain',
    jute: 'commercial',
    kinnow: 'fruit',
    lemon: 'fruit',
    maize: 'grain',
    mango: 'fruit',
    marigold: 'flower',
    masur: 'pulse',
    moong: 'pulse',
    nigerseed: 'oilseed',
    okra: 'vegetable',
    onion: 'vegetable',
    orange: 'fruit',
    papaya: 'fruit',
    paddy: 'grain',
    potato: 'vegetable',
    pomegranate: 'fruit',
    radish: 'vegetable',
    ragi: 'grain',
    rajma: 'pulse',
    'rapeseed-mustard': 'oilseed',
    rose: 'flower',
    safflower: 'oilseed',
    sesamum: 'oilseed',
    soybean: 'oilseed',
    spinach: 'vegetable',
    sugarcane: 'commercial',
    'sunflower-seed': 'oilseed',
    'sweet-lime': 'fruit',
    tea: 'plantation',
    tomato: 'vegetable',
    toria: 'oilseed',
    tur: 'pulse',
    turmeric: 'spice',
    urad: 'pulse',
    watermelon: 'fruit',
    wheat: 'grain',
};

const EXCLUDED_MSP_COMMODITIES = new Set([
    'barley',
    'bajra',
    'copra',
    'cotton',
    'de-husked-coconut',
    'gram',
    'groundnut',
    'jowar',
    'jute',
    'maize',
    'masur',
    'moong',
    'nigerseed',
    'paddy',
    'ragi',
    'rapeseed-mustard',
    'safflower',
    'sesamum',
    'soybean',
    'sunflower-seed',
    'toria',
    'tur',
    'urad',
    'wheat',
]);

const MANUALLY_EXCLUDED_COMMODITIES = new Set([]);

function normalizeWhitespace(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function toSlug(value) {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/[^a-z0-9\u0900-\u097f]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function titleFromSlug(value) {
    return String(value || '')
        .split('-')
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeState(value) {
    const normalized = normalizeWhitespace(value).toLowerCase();
    if (!normalized) {
        return null;
    }

    if (STATE_ALIASES[normalized]) {
        return STATE_ALIASES[normalized];
    }

    return normalized
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function normalizeCommodity(value) {
    const normalized = toSlug(value);
    return COMMODITY_ALIASES[normalized] || normalized || null;
}

function normalizeDistrict(value) {
    const normalized = normalizeWhitespace(value);
    if (!normalized) {
        return null;
    }

    return normalized
        .split(' ')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

function normalizeMarketName(value) {
    return normalizeWhitespace(value);
}

function getCommodityLabels(slug) {
    return COMMODITY_LABELS[slug] || {
        en: titleFromSlug(slug),
        hi: titleFromSlug(slug),
    };
}

function getCommodityCategory(slug) {
    return CATEGORY_BY_COMMODITY[slug] || 'other';
}

function getCommodityPolicy(slug) {
    if (MANUALLY_EXCLUDED_COMMODITIES.has(slug)) {
        return POLICY_STATUSES.EXCLUDED_MANUAL;
    }
    if (EXCLUDED_MSP_COMMODITIES.has(slug)) {
        return POLICY_STATUSES.EXCLUDED_MSP;
    }
    return POLICY_STATUSES.ELIGIBLE_NON_MSP;
}

function getCommodityMetadata(value) {
    const id = normalizeCommodity(value);
    if (!id) {
        return null;
    }

    const labels = getCommodityLabels(id);
    return {
        category: getCommodityCategory(id),
        id,
        label: labels.en,
        labelHi: labels.hi,
        policyStatus: getCommodityPolicy(id),
    };
}

module.exports = {
    COMMODITY_ALIASES,
    COMMODITY_LABELS,
    EXCLUDED_MSP_COMMODITIES,
    MANUALLY_EXCLUDED_COMMODITIES,
    POLICY_STATUSES,
    getCommodityCategory,
    getCommodityLabels,
    getCommodityMetadata,
    getCommodityPolicy,
    normalizeCommodity,
    normalizeDistrict,
    normalizeMarketName,
    normalizeState,
    normalizeWhitespace,
    titleFromSlug,
    toSlug,
};
