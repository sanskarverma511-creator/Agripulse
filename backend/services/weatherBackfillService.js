const axios = require('axios');

function nowIso() {
    return new Date().toISOString();
}

function mean(values) {
    const numbers = values.filter((value) => Number.isFinite(value));
    if (numbers.length === 0) {
        return null;
    }
    return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function sum(values) {
    const numbers = values.filter((value) => Number.isFinite(value));
    if (numbers.length === 0) {
        return null;
    }
    return numbers.reduce((total, value) => total + value, 0);
}

function buildWeatherFingerprint(doc) {
    const raw = JSON.stringify([
        doc.marketId,
        doc.date,
        doc.humidity,
        doc.precipitationMm,
        doc.temperatureMax,
        doc.temperatureMin,
        doc.weatherCode,
        doc.weatherResolution,
        doc.source,
    ]);
    return require('crypto').createHash('sha1').update(raw).digest('hex');
}

function aggregateHourlyWeather(payload) {
    const hourly = payload?.hourly;
    if (!hourly?.time || !Array.isArray(hourly.time)) {
        return [];
    }

    const byDate = new Map();
    for (let index = 0; index < hourly.time.length; index += 1) {
        const timestamp = String(hourly.time[index] || '');
        const date = timestamp.slice(0, 10);
        if (!date) {
            continue;
        }
        if (!byDate.has(date)) {
            byDate.set(date, {
                humidity: [],
                precipitation: [],
                temperature: [],
                weatherCode: [],
            });
        }
        const entry = byDate.get(date);
        entry.humidity.push(Number(hourly.relative_humidity_2m?.[index]));
        entry.precipitation.push(Number(hourly.precipitation?.[index]));
        entry.temperature.push(Number(hourly.temperature_2m?.[index]));
        entry.weatherCode.push(Number(hourly.weather_code?.[index]));
    }

    return [...byDate.entries()].map(([date, values]) => {
        const tempNumbers = values.temperature.filter((value) => Number.isFinite(value));
        const codeNumbers = values.weatherCode.filter((value) => Number.isFinite(value));
        return {
            date,
            humidity: mean(values.humidity),
            precipitationMm: sum(values.precipitation),
            temperatureMax: tempNumbers.length ? Math.max(...tempNumbers) : null,
            temperatureMin: tempNumbers.length ? Math.min(...tempNumbers) : null,
            weatherCode: codeNumbers.length ? codeNumbers[codeNumbers.length - 1] : null,
        };
    });
}

async function fetchArchiveWeather(market, startDate, endDate) {
    const params = {
        end_date: endDate,
        hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code',
        latitude: market.lat,
        longitude: market.lon,
        start_date: startDate,
        timezone: 'UTC',
    };
    const response = await axios.get('https://archive-api.open-meteo.com/v1/archive', {
        params,
        timeout: 120000,
        validateStatus: (status) => status >= 200 && status < 400,
    });
    return aggregateHourlyWeather(response.data);
}

async function marketDateRanges(db) {
    return db.collection('daily_prices').aggregate([
        {
            $match: {
                $or: [{ isCertified: true }, { source: 'seed-bootstrap' }],
            },
        },
        {
            $group: {
                _id: '$marketId',
                endDate: { $max: '$date' },
                startDate: { $min: '$date' },
            },
        },
    ]).toArray();
}

async function backfillHistoricalWeather(db) {
    const markets = await db.collection('markets').find({
        lat: { $ne: null },
        lon: { $ne: null },
    }).toArray();
    const ranges = await marketDateRanges(db);
    const rangeMap = new Map(ranges.map((entry) => [entry._id, entry]));
    const summary = {
        failedMarkets: 0,
        insertedRows: 0,
        processedMarkets: 0,
        skippedMarkets: 0,
        updatedRows: 0,
    };

    for (const market of markets) {
        const range = rangeMap.get(market._id);
        if (!range?.startDate || !range?.endDate) {
            summary.skippedMarkets += 1;
            continue;
        }

        try {
            const rows = await fetchArchiveWeather(market, range.startDate, range.endDate);
            for (const row of rows) {
                const doc = {
                    approvalStatus: 'certified',
                    certifiedAt: nowIso(),
                    date: row.date,
                    district: market.district,
                    humidity: row.humidity,
                    ingestedAt: nowIso(),
                    isCertified: true,
                    marketId: market._id,
                    marketName: market.name,
                    precipitationMm: row.precipitationMm,
                    schemaVersion: 'weather-backfill-v1',
                    source: 'open-meteo-archive',
                    sourceFingerprint: '',
                    sourceName: 'Open-Meteo Archive',
                    sourceType: 'approved_public_weather',
                    sourceUrl: 'https://archive-api.open-meteo.com/v1/archive',
                    state: market.state,
                    temperatureMax: row.temperatureMax,
                    temperatureMin: row.temperatureMin,
                    weatherCode: row.weatherCode,
                    weatherResolution: 'market',
                };
                doc.sourceFingerprint = buildWeatherFingerprint(doc);
                doc.equivalenceKey = `${doc.marketId}|${doc.date}|${doc.sourceFingerprint}`;

                const result = await db.collection('weather_history').updateOne(
                    {
                        date: doc.date,
                        marketId: doc.marketId,
                        source: doc.source,
                    },
                    {
                        $set: doc,
                        $setOnInsert: {
                            _id: `${doc.marketId}-${doc.date}-${doc.source}`,
                        },
                    },
                    { upsert: true },
                );

                if (result.upsertedCount > 0) {
                    summary.insertedRows += 1;
                } else if (result.modifiedCount > 0) {
                    summary.updatedRows += 1;
                }
            }
            summary.processedMarkets += 1;
        } catch (error) {
            summary.failedMarkets += 1;
            await db.collection('quarantine_rows').insertOne({
                createdAt: nowIso(),
                reason: error.message,
                sourceName: 'Open-Meteo Archive',
                sourceType: 'public_weather',
                sourceUrl: 'https://archive-api.open-meteo.com/v1/archive',
                weatherMarketId: market._id,
            });
        }
    }

    return summary;
}

module.exports = {
    backfillHistoricalWeather,
};
