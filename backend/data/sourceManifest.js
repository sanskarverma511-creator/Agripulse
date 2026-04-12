const fs = require('fs');
const path = require('path');

const DEFAULT_SOURCES = [
    {
        category: 'price',
        catalogUrl: 'https://www.data.gov.in/resource/current-daily-price-various-commodities-various-markets-mandi',
        description: 'Primary official mandi-price catalog entry from the Open Government Data platform.',
        downloadUrl: process.env.OGD_CURRENT_MANDI_DOWNLOAD_URL || '',
        formatHint: 'csv_or_zip',
        id: 'official-current-mandi',
        metadataDiscovery: 'ogd_resource',
        name: 'OGD Current Daily Mandi Prices',
        pageSize: 10000,
        resourceSlug: 'current-daily-price-various-commodities-various-markets-mandi',
        sourceType: 'official',
    },
    {
        category: 'price',
        catalogUrl: 'https://www.data.gov.in/resource/variety-wise-daily-market-prices-data-commodity',
        description: 'Official variety-wise mandi-price feed. Supply a direct CSV/ZIP URL through environment configuration.',
        downloadUrl: process.env.OGD_VARIETY_MANDI_DOWNLOAD_URL || '',
        formatHint: 'csv_or_zip',
        id: 'official-variety-mandi',
        maxRecordsEnv: 'OGD_VARIETY_MAX_RECORDS',
        metadataDiscovery: 'ogd_resource',
        name: 'OGD Variety-wise Mandi Prices',
        pageSize: 10000,
        resourceSlug: 'variety-wise-daily-market-prices-data-commodity',
        sourceType: 'official',
    },
    {
        category: 'weather',
        catalogUrl: process.env.PUBLIC_WEATHER_CATALOG_URL || '',
        description: 'Public historical weather CSV/ZIP source used to backfill training weather history.',
        downloadUrl: process.env.PUBLIC_WEATHER_DOWNLOAD_URL || '',
        formatHint: 'csv_or_zip',
        id: 'public-historical-weather',
        name: 'Public Historical Weather',
        sourceType: 'public_weather',
    },
];

function loadLocalManifest() {
    const localPath = path.resolve(__dirname, 'sourceManifest.local.json');
    if (!fs.existsSync(localPath)) {
        return [];
    }

    try {
        const parsed = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Could not parse sourceManifest.local.json', error.message);
        return [];
    }
}

function loadEnvPublicSources() {
    const raw = String(process.env.PUBLIC_DATASET_URLS || '').trim();
    if (!raw) {
        return [];
    }

    return raw
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((downloadUrl, index) => ({
            category: 'price',
            catalogUrl: '',
            description: 'Allowlisted public CSV/ZIP source configured through PUBLIC_DATASET_URLS.',
            downloadUrl,
            formatHint: 'csv_or_zip',
            id: `public-source-${index + 1}`,
            name: `Public Source ${index + 1}`,
            sourceType: 'public_staging',
        }));
}

function getConfiguredSources() {
    return [...DEFAULT_SOURCES, ...loadEnvPublicSources(), ...loadLocalManifest()]
        .map((source) => ({
            enabled: source.enabled !== false,
            ...source,
        }))
        .filter((source) => source.enabled);
}

module.exports = {
    getConfiguredSources,
};
