const SUPPORTED_STATES = ['Chhattisgarh', 'Madhya Pradesh'];

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
    chana: 'gram',
    chickpea: 'gram',
    corn: 'maize',
    dhan: 'paddy',
    gram: 'gram',
    makka: 'maize',
    maize: 'maize',
    onion: 'onion',
    paddy: 'paddy',
    potato: 'potato',
    rice: 'paddy',
    soyabean: 'soybean',
    soybean: 'soybean',
    sugarcane: 'sugarcane',
    tamatar: 'tomato',
    tomato: 'tomato',
    wheat: 'wheat',
};

const COMMODITY_LABELS = {
    gram: { en: 'Gram', hi: '\u091a\u0928\u093e' },
    maize: { en: 'Maize', hi: '\u092e\u0915\u094d\u0915\u093e' },
    onion: { en: 'Onion', hi: '\u092a\u094d\u092f\u093e\u091c' },
    paddy: { en: 'Paddy', hi: '\u0927\u093e\u0928' },
    potato: { en: 'Potato', hi: '\u0906\u0932\u0942' },
    soybean: { en: 'Soybean', hi: '\u0938\u094b\u092f\u093e\u092c\u0940\u0928' },
    tomato: { en: 'Tomato', hi: '\u091f\u092e\u093e\u091f\u0930' },
    wheat: { en: 'Wheat', hi: '\u0917\u0947\u0939\u0942\u0901' },
    sugarcane: { en: 'Sugarcane', hi: '\u0917\u0928\u094d\u0928\u093e' },
};

function normalizeWhitespace(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim();
}

function toSlug(value) {
    return normalizeWhitespace(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeState(value) {
    const normalized = normalizeWhitespace(value).toLowerCase();
    return STATE_ALIASES[normalized] || null;
}

function normalizeCommodity(value) {
    const normalized = toSlug(value);
    return COMMODITY_ALIASES[normalized] || null;
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
        en: slug.charAt(0).toUpperCase() + slug.slice(1),
        hi: slug.charAt(0).toUpperCase() + slug.slice(1),
    };
}

module.exports = {
    COMMODITY_LABELS,
    SUPPORTED_STATES,
    getCommodityLabels,
    normalizeCommodity,
    normalizeDistrict,
    normalizeMarketName,
    normalizeState,
    normalizeWhitespace,
    toSlug,
};
