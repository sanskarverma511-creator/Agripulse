const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const axios = require('axios');

const { getConfiguredSources } = require('../data/sourceManifest');

const DATA_INGEST_ROOT = path.resolve(__dirname, '..', '..', 'db', 'data_ingest');
const DEFAULT_OGD_PAGE_SIZE = 10000;

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
    return dirPath;
}

function nowIso() {
    return new Date().toISOString();
}

function sanitizeFilename(value) {
    return String(value || 'file')
        .replace(/[^a-z0-9._-]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        || 'file';
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function batchId(prefix = 'ingest') {
    return `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}`;
}

function sourceMatch(source, requestedKind) {
    if (!requestedKind || requestedKind === 'all') {
        return true;
    }
    if (requestedKind === 'weather') {
        return source.category === 'weather';
    }
    return source.sourceType === requestedKind;
}

async function resolveDownloadUrl(source) {
    if (source.downloadUrl) {
        return source.downloadUrl.trim();
    }

    if (source.metadataDiscovery === 'ogd_resource' && source.resourceSlug) {
        const metadataUrl = `https://www.data.gov.in/backend/dms/v1/resource/${source.resourceSlug}?_format=json`;
        const response = await axios.get(metadataUrl, {
            timeout: 30000,
            validateStatus: (status) => status >= 200 && status < 400,
        });
        const resource = response.data || {};
        const dataApiUrl = resource?.field_datafile_url?.[0]?.uri;
        const fileUrl = resource?.field_datafile?.[0]?.url;
        const resolvedUrl = String(dataApiUrl || fileUrl || '').trim();
        if (!resolvedUrl) {
            throw new Error(`No downloadable file URL found in OGD metadata for ${source.resourceSlug}.`);
        }
        return resolvedUrl.replace(/\s+/g, '');
    }

    return '';
}

function parsePositiveInt(value) {
    const parsed = Number.parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function envPositiveInt(name) {
    return parsePositiveInt(process.env[name]);
}

function ogdPageSize(source) {
    return (
        envPositiveInt('OGD_API_PAGE_SIZE')
        || parsePositiveInt(source.pageSize)
        || DEFAULT_OGD_PAGE_SIZE
    );
}

function ogdMaxRecords(source) {
    if (source.maxRecords === null) {
        return null;
    }

    return (
        parsePositiveInt(source.maxRecords)
        || (source.maxRecordsEnv ? envPositiveInt(source.maxRecordsEnv) : null)
        || null
    );
}

function isOgdApiUrl(downloadUrl) {
    try {
        const parsed = new URL(downloadUrl);
        return parsed.hostname === 'api.data.gov.in' && /^\/resource\/[^/]+$/i.test(parsed.pathname);
    } catch (error) {
        return false;
    }
}

function csvEscape(value) {
    if (value === undefined || value === null) {
        return '';
    }

    const text = String(value);
    if (/[",\r\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}

function recordToCsvLine(record, headers) {
    return headers.map((header) => csvEscape(record[header])).join(',');
}

async function requestJsonWithRetry(url, config, retries = 4) {
    let lastError;
    for (let attempt = 1; attempt <= retries; attempt += 1) {
        try {
            return await axios.get(url, config);
        } catch (error) {
            lastError = error;
            if (attempt === retries) {
                break;
            }
            await wait(1000 * attempt);
        }
    }
    throw lastError;
}

async function downloadOgdApiCsv(downloadUrl, rawPath, source) {
    const parsedUrl = new URL(downloadUrl);
    const baseUrl = `${parsedUrl.origin}${parsedUrl.pathname}`;
    const baseParams = {};
    for (const [key, value] of parsedUrl.searchParams.entries()) {
        if (!['format', 'limit', 'offset'].includes(key)) {
            baseParams[key] = value;
        }
    }

    const pageSize = ogdPageSize(source);
    const maxRecords = ogdMaxRecords(source);
    let offset = parsePositiveInt(parsedUrl.searchParams.get('offset')) || 0;
    let headers = null;
    let total = null;
    let writtenRows = 0;
    const writer = fs.createWriteStream(rawPath, { encoding: 'utf8' });

    try {
        while (true) {
            const remaining = maxRecords === null ? pageSize : Math.min(pageSize, maxRecords - writtenRows);
            if (remaining <= 0) {
                break;
            }

            const response = await requestJsonWithRetry(baseUrl, {
                params: {
                    ...baseParams,
                    format: 'json',
                    limit: remaining,
                    offset,
                },
                timeout: 120000,
                validateStatus: (status) => status >= 200 && status < 400,
            });
            const payload = response.data || {};
            const records = Array.isArray(payload.records) ? payload.records : [];

            if (!headers) {
                headers = records[0] ? Object.keys(records[0]) : [];
                if (headers.length === 0 && Array.isArray(payload.field)) {
                    headers = payload.field
                        .map((field) => field?.id || field?.name || '')
                        .filter(Boolean);
                }
                if (headers.length > 0) {
                    writer.write(`${headers.map(csvEscape).join(',')}\n`);
                }
                total = parsePositiveInt(payload.total) || null;
            }

            if (records.length === 0) {
                break;
            }

            for (const record of records) {
                writer.write(`${recordToCsvLine(record, headers)}\n`);
            }

            writtenRows += records.length;
            offset += records.length;

            if (records.length < remaining) {
                break;
            }
            if (total !== null && offset >= total) {
                break;
            }
        }
    } finally {
        await new Promise((resolve, reject) => {
            writer.end(() => resolve());
            writer.on('error', reject);
        });
    }

    return {
        rowsWritten: writtenRows,
        totalAvailable: total,
    };
}

function fileExtensionFromUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        return path.extname(pathname).toLowerCase();
    } catch (error) {
        return path.extname(String(url || '')).toLowerCase();
    }
}

function contentTypeToExtension(contentType) {
    if (!contentType) {
        return '';
    }
    if (contentType.includes('zip')) {
        return '.zip';
    }
    if (contentType.includes('csv')) {
        return '.csv';
    }
    if (contentType.includes('json')) {
        return '.json';
    }
    return '';
}

function sha256ForFile(filePath) {
    const hash = crypto.createHash('sha256');
    hash.update(fs.readFileSync(filePath));
    return hash.digest('hex');
}

function inferSchemaType(filePath) {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === '.csv') {
        return 'csv';
    }
    if (extension === '.zip') {
        return 'zip';
    }
    if (extension === '.json') {
        return 'json';
    }
    return 'unknown';
}

function extractZipWithTar(zipPath, destinationDir) {
    const tarResult = spawnSync('tar', ['-xf', zipPath, '-C', destinationDir], {
        stdio: 'pipe',
    });
    if (tarResult.status === 0) {
        return true;
    }

    if (process.platform === 'win32') {
        const powershell = spawnSync(
            'powershell',
            [
                '-NoProfile',
                '-Command',
                `Expand-Archive -LiteralPath '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destinationDir.replace(/'/g, "''")}' -Force`,
            ],
            { stdio: 'pipe' },
        );
        if (powershell.status === 0) {
            return true;
        }
    }

    const message = tarResult.stderr?.toString() || 'Could not extract ZIP archive.';
    throw new Error(message.trim());
}

function prepareIngestPaths() {
    const rawDir = ensureDir(path.join(DATA_INGEST_ROOT, 'raw'));
    const extractedDir = ensureDir(path.join(DATA_INGEST_ROOT, 'extracted'));
    const manifestsDir = ensureDir(path.join(DATA_INGEST_ROOT, 'manifests'));
    return {
        extractedDir,
        manifestsDir,
        rawDir,
        root: DATA_INGEST_ROOT,
    };
}

async function createIngestBatch(db, kind) {
    const _id = batchId(kind);
    const doc = {
        _id,
        createdAt: nowIso(),
        kind,
        sourceCount: 0,
        status: 'running',
    };
    await db.collection('ingest_batches').insertOne(doc);
    return doc;
}

async function downloadSource(db, source, ingestBatch) {
    const downloadUrl = await resolveDownloadUrl(source);
    if (!downloadUrl) {
        const skipped = {
            createdAt: nowIso(),
            downloadUrl: '',
            extractedPaths: [],
            ingestBatchId: ingestBatch._id,
            localPath: null,
            name: source.name,
            reason: 'Missing direct downloadUrl configuration.',
            sourceId: source.id,
            sourceType: source.sourceType,
            status: 'skipped',
        };
        await db.collection('ingest_files').insertOne(skipped);
        return skipped;
    }

    const paths = prepareIngestPaths();
    const extension =
        (isOgdApiUrl(downloadUrl) ? '.csv' : '') ||
        fileExtensionFromUrl(downloadUrl) ||
        contentTypeToExtension(source.contentType) ||
        '.bin';
    const filename = `${sanitizeFilename(source.id)}-${Date.now()}${extension}`;
    const rawPath = path.join(paths.rawDir, filename);

    let ogdDownloadSummary = null;
    if (isOgdApiUrl(downloadUrl)) {
        ogdDownloadSummary = await downloadOgdApiCsv(downloadUrl, rawPath, source);
    } else {
        const response = await axios.get(downloadUrl, {
            maxRedirects: 5,
            responseType: 'stream',
            timeout: 120000,
            validateStatus: (status) => status >= 200 && status < 400,
        });

        await new Promise((resolve, reject) => {
            const writer = fs.createWriteStream(rawPath);
            response.data.pipe(writer);
            writer.on('finish', resolve);
            writer.on('error', reject);
        });
    }

    const checksum = sha256ForFile(rawPath);
    const existing = await db.collection('ingest_files').findOne({ checksum });
    if (existing) {
        fs.unlinkSync(rawPath);
        return {
            ...existing,
            status: 'duplicate',
        };
    }

    let extractedPaths = [rawPath];
    if (inferSchemaType(rawPath) === 'zip') {
        const extractDir = ensureDir(
            path.join(paths.extractedDir, `${sanitizeFilename(source.id)}-${Date.now()}`),
        );
        extractZipWithTar(rawPath, extractDir);
        extractedPaths = fs
            .readdirSync(extractDir)
            .map((entry) => path.join(extractDir, entry))
            .filter((entryPath) => fs.statSync(entryPath).isFile());
    }

    const doc = {
        _id: `${source.id}-${checksum.slice(0, 16)}`,
        catalogUrl: source.catalogUrl || '',
        category: source.category,
        checksum,
        createdAt: nowIso(),
        detectedSchema: null,
        downloadUrl,
        extractedPaths,
        fileFormat: inferSchemaType(rawPath),
        importStatus: 'pending',
        ingestBatchId: ingestBatch._id,
        localPath: rawPath,
        metadata: {
            commodityCoverage: [],
            dateRange: null,
            detectedHeaders: [],
            downloadedRows: ogdDownloadSummary?.rowsWritten ?? null,
            stateCoverage: [],
            totalAvailableRows: ogdDownloadSummary?.totalAvailable ?? null,
        },
        sourceId: source.id,
        sourceName: source.name,
        sourceType: source.sourceType,
        status: 'downloaded',
    };

    await db.collection('ingest_files').insertOne(doc);
    return doc;
}

async function fetchConfiguredSources(db, kind = 'all') {
    const sources = getConfiguredSources().filter((source) => sourceMatch(source, kind));
    const ingestBatch = await createIngestBatch(db, `fetch-${kind}`);
    const results = [];

    for (const source of sources) {
        try {
            results.push(await downloadSource(db, source, ingestBatch));
        } catch (error) {
            const failed = {
                createdAt: nowIso(),
                downloadUrl: source.downloadUrl || '',
                ingestBatchId: ingestBatch._id,
                name: source.name,
                reason: error.message,
                sourceId: source.id,
                sourceType: source.sourceType,
                status: 'failed',
            };
            await db.collection('ingest_files').insertOne(failed);
            results.push(failed);
        }
    }

    await db.collection('ingest_batches').updateOne(
        { _id: ingestBatch._id },
        {
            $set: {
                completedAt: nowIso(),
                resultSummary: {
                    downloaded: results.filter((result) => result.status === 'downloaded').length,
                    failed: results.filter((result) => result.status === 'failed').length,
                    skipped: results.filter((result) => result.status === 'skipped').length,
                },
                sourceCount: sources.length,
                status: 'completed',
            },
        },
    );

    return {
        ingestBatchId: ingestBatch._id,
        results,
        sources: sources.length,
    };
}

async function getPendingIngestFiles(db, sourceType) {
    const query = { importStatus: 'pending', status: 'downloaded' };
    if (sourceType) {
        query.sourceType = sourceType;
    }
    return db.collection('ingest_files').find(query).sort({ createdAt: 1 }).toArray();
}

module.exports = {
    DATA_INGEST_ROOT,
    fetchConfiguredSources,
    getPendingIngestFiles,
    prepareIngestPaths,
    sha256ForFile,
};
