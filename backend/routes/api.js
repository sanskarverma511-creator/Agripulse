const express = require('express');

const {
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
} = require('../services/platformService');

const router = express.Router();

function asyncRoute(handler) {
    return async (req, res, next) => {
        try {
            await handler(req, res);
        } catch (err) {
            next(err);
        }
    };
}

router.get('/health', asyncRoute(async (req, res) => {
    res.json({ status: 'ok' });
}));

router.get('/states', asyncRoute(async (req, res) => {
    res.json({ states: await getStates() });
}));

router.get('/districts', asyncRoute(async (req, res) => {
    res.json(await getDistricts(req.query.state));
}));

router.get('/commodities', asyncRoute(async (req, res) => {
    res.json(await getCommodities(req.query.state));
}));

router.post('/recommendations', asyncRoute(async (req, res) => {
    res.json(await getRecommendation(req.body));
}));

router.get('/compare', asyncRoute(async (req, res) => {
    res.json(await getComparison(req.query));
}));

router.get('/markets/:id', asyncRoute(async (req, res) => {
    res.json(
        await getMarketDetail(req.params.id, req.query.commodity, {
            quantity: req.query.quantity,
            transportCostPerKm: req.query.transportCostPerKm,
        }),
    );
}));

router.get('/markets/:id/forecast', asyncRoute(async (req, res) => {
    res.json(
        await getForecast(req.params.id, req.query.commodity, {
            quantity: req.query.quantity,
            transportCostPerKm: req.query.transportCostPerKm,
        }),
    );
}));

router.post('/alerts', asyncRoute(async (req, res) => {
    res.status(201).json(await createAlert(req.body));
}));

router.get('/alerts', asyncRoute(async (req, res) => {
    res.json({ alerts: await getAlerts() });
}));

router.get('/dashboard/summary', asyncRoute(async (req, res) => {
    res.json(await getDashboardSummary());
}));

module.exports = router;
