require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const { getDb } = require('./config/mongo');
const apiRoutes = require('./routes/api');
const { ensurePlatformReady } = require('./services/bootstrap');

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.use('/api', apiRoutes);

// Global Error Handler
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.statusCode || 500).json({ error: err.message || 'Something broke!' });
});

async function start() {
    const db = await getDb();
    const bootstrap = await ensurePlatformReady(db);
    console.log('MongoDB ready', bootstrap);

    app.listen(PORT, () => {
        console.log(`Node backend running on port ${PORT}`);
    });
}

start().catch((err) => {
    console.error('Failed to start backend', err);
    process.exit(1);
});
