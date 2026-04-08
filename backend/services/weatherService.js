const axios = require('axios');

const WEATHER_API_URL = process.env.WEATHER_API_URL || 'https://api.open-meteo.com/v1/forecast';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function roundNumber(value, digits = 1) {
    if (!Number.isFinite(value)) {
        return null;
    }
    return Number(value.toFixed(digits));
}

function average(values) {
    if (!values.length) {
        return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values) {
    return values.reduce((total, value) => total + value, 0);
}

function asWeatherUnavailable(extra = {}) {
    return {
        conditionLabel: 'Weather unavailable',
        current: null,
        daily: [],
        fetchedAt: null,
        note: extra.note || 'Live weather data could not be fetched for this market.',
        resolvedFrom: extra.resolvedFrom || null,
        source: 'open-meteo',
        status: extra.status || 'unavailable',
        window: null,
    };
}

function deriveConditionLabel({ humidity, precipitationMm, temperatureMax, weatherCode }) {
    if (weatherCode >= 95) {
        return 'Stormy';
    }
    if (precipitationMm >= 12) {
        return 'Rainy';
    }
    if (humidity >= 82) {
        return 'Humid';
    }
    if (temperatureMax >= 36) {
        return 'Hot';
    }
    if (temperatureMax <= 18) {
        return 'Cool';
    }
    return 'Clear';
}

function buildHumidityByDay(hourly) {
    const humidityByDay = new Map();
    const times = hourly?.time || [];
    const humidityValues = hourly?.relative_humidity_2m || [];

    times.forEach((timestamp, index) => {
        const date = String(timestamp).slice(0, 10);
        const humidity = humidityValues[index];
        if (!Number.isFinite(humidity)) {
            return;
        }
        if (!humidityByDay.has(date)) {
            humidityByDay.set(date, []);
        }
        humidityByDay.get(date).push(humidity);
    });

    return humidityByDay;
}

function normalizeWeatherResponse(payload, resolvedFrom) {
    const humidityByDay = buildHumidityByDay(payload.hourly);
    const dates = payload.daily?.time || [];
    const daily = dates.map((date, index) => {
        const humidity = average(humidityByDay.get(date) || []) || 0;
        const temperatureMax = payload.daily?.temperature_2m_max?.[index] ?? null;
        const temperatureMin = payload.daily?.temperature_2m_min?.[index] ?? null;
        const precipitationMm = payload.daily?.precipitation_sum?.[index] ?? 0;
        const weatherCode = payload.daily?.weather_code?.[index] ?? 0;

        return {
            conditionLabel: deriveConditionLabel({
                humidity,
                precipitationMm,
                temperatureMax: temperatureMax ?? 0,
                weatherCode,
            }),
            date,
            humidity: roundNumber(humidity),
            precipitationMm: roundNumber(precipitationMm),
            temperatureMax: roundNumber(temperatureMax),
            temperatureMin: roundNumber(temperatureMin),
            weatherCode,
        };
    });

    if (daily.length === 0) {
        return asWeatherUnavailable({ resolvedFrom });
    }

    const futureDays = daily.slice(1, 8);
    const summaryDays = futureDays.length > 0 ? futureDays : daily;
    const precipitationValues = summaryDays.map((day) => day.precipitationMm || 0);
    const humidityValues = summaryDays.map((day) => day.humidity || 0);
    const maxTemps = summaryDays.map((day) => day.temperatureMax || 0);
    const minTemps = summaryDays.map((day) => day.temperatureMin || 0);
    const conditionBucket = {};
    for (const day of summaryDays) {
        conditionBucket[day.conditionLabel] = (conditionBucket[day.conditionLabel] || 0) + 1;
    }
    const dominantCondition = Object.entries(conditionBucket).sort((left, right) => right[1] - left[1])[0]?.[0];

    return {
        conditionLabel: dominantCondition || daily[0].conditionLabel,
        current: daily[0],
        daily,
        fetchedAt: new Date().toISOString(),
        note: null,
        resolvedFrom,
        source: 'open-meteo',
        status: 'available',
        window: {
            averageHumidity: roundNumber(average(humidityValues)),
            averageMaxTemp: roundNumber(average(maxTemps)),
            averageMinTemp: roundNumber(average(minTemps)),
            rainyDays: precipitationValues.filter((value) => value >= 2).length,
            totalPrecipitation: roundNumber(sum(precipitationValues)),
        },
    };
}

async function resolveCoordinates(db, market) {
    if (Number.isFinite(market?.lat) && Number.isFinite(market?.lon)) {
        return {
            lat: market.lat,
            lon: market.lon,
            resolvedFrom: 'market',
        };
    }

    const [districtAverage] = await db.collection('markets').aggregate([
        {
            $match: {
                district: market.district,
                lat: { $ne: null, $type: 'number' },
                lon: { $ne: null, $type: 'number' },
                state: market.state,
            },
        },
        {
            $group: {
                _id: null,
                lat: { $avg: '$lat' },
                lon: { $avg: '$lon' },
            },
        },
    ]).toArray();

    if (!districtAverage) {
        return null;
    }

    return {
        lat: roundNumber(districtAverage.lat, 4),
        lon: roundNumber(districtAverage.lon, 4),
        resolvedFrom: 'district-average',
    };
}

async function fetchWeather(lat, lon) {
    const response = await axios.get(WEATHER_API_URL, {
        params: {
            daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum',
            forecast_days: 8,
            hourly: 'relative_humidity_2m',
            latitude: lat,
            longitude: lon,
            timezone: 'auto',
        },
        timeout: 4000,
    });

    return response.data;
}

async function getCachedWeather(db, marketId) {
    const snapshot = await db.collection('weather_snapshots').findOne({ marketId });
    if (!snapshot) {
        return null;
    }

    const fetchedAtMs = new Date(snapshot.fetchedAt).getTime();
    const ageMs = Number.isFinite(fetchedAtMs) ? Date.now() - fetchedAtMs : Number.POSITIVE_INFINITY;

    return {
        isFresh: ageMs < CACHE_TTL_MS,
        snapshot,
    };
}

async function saveWeatherSnapshot(db, market, coordinates, summary) {
    await db.collection('weather_snapshots').updateOne(
        { marketId: market._id },
        {
            $set: {
                district: market.district,
                fetchedAt: summary.fetchedAt,
                lat: coordinates.lat,
                lon: coordinates.lon,
                marketId: market._id,
                resolvedFrom: summary.resolvedFrom,
                state: market.state,
                summary,
            },
        },
        { upsert: true },
    );
}

async function getWeatherForMarket(db, market) {
    const coordinates = await resolveCoordinates(db, market);
    if (!coordinates) {
        return asWeatherUnavailable({
            note: 'No market or district coordinates were available for live weather lookup.',
        });
    }

    const cached = await getCachedWeather(db, market._id);
    if (cached?.isFresh) {
        return cached.snapshot.summary;
    }

    try {
        const payload = await fetchWeather(coordinates.lat, coordinates.lon);
        const summary = normalizeWeatherResponse(payload, coordinates.resolvedFrom);
        await saveWeatherSnapshot(db, market, coordinates, summary);
        return summary;
    } catch (error) {
        if (cached?.snapshot?.summary) {
            return {
                ...cached.snapshot.summary,
                note: 'Showing the latest cached weather snapshot because the live provider is unavailable.',
                status: 'stale',
            };
        }

        return asWeatherUnavailable({
            note: 'Live weather provider is unavailable right now. Predictions continue with historical market data.',
            resolvedFrom: coordinates.resolvedFrom,
        });
    }
}

module.exports = {
    getWeatherForMarket,
    normalizeWeatherResponse,
    resolveCoordinates,
};
