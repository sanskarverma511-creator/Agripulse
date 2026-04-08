const axios = require('axios');

const MODEL_SERVICE_URL = process.env.MODEL_SERVICE_URL || 'http://localhost:8001';

function buildErrorMessage(err) {
    if (err.response?.data?.detail) {
        return err.response.data.detail;
    }
    if (err.response?.data?.error) {
        return err.response.data.error;
    }
    return err.message || 'Model service is unavailable';
}

async function predictMarkets(payload) {
    try {
        const response = await axios.post(`${MODEL_SERVICE_URL}/predict`, payload, {
            timeout: 10000,
        });
        return response.data;
    } catch (err) {
        const error = new Error(buildErrorMessage(err));
        error.statusCode = err.response?.status || 502;
        throw error;
    }
}

async function forecastMarket(payload) {
    try {
        const response = await axios.post(`${MODEL_SERVICE_URL}/forecast`, payload, {
            timeout: 10000,
        });
        return response.data;
    } catch (err) {
        const error = new Error(buildErrorMessage(err));
        error.statusCode = err.response?.status || 502;
        throw error;
    }
}

module.exports = {
    forecastMarket,
    predictMarkets,
};
