import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ArrowLeft, CloudRain, Droplets, Thermometer } from 'lucide-react';
import { api } from '../lib/api';
import { formatCurrency, formatNumber, riskClass } from '../lib/formatters';
import { useI18n } from '../context/I18nContext';

const anomalyDot = ({ cx, cy, payload }) => {
  if (!payload?.isAnomaly) {
    return <circle cx={cx} cy={cy} r={3} fill="#0ea5e9" />;
  }

  return <circle cx={cx} cy={cy} r={6} fill="#e11d48" stroke="#fff" strokeWidth={2} />;
};

const weatherImpactClass = (label) => {
  if (label === 'Risky') return 'bg-rose-100 text-rose-700';
  if (label === 'Mixed') return 'bg-amber-100 text-amber-700';
  if (label === 'Favorable') return 'bg-emerald-100 text-emerald-700';
  return 'bg-slate-100 text-slate-600';
};

const formatTempBand = (point) => {
  if (point?.temperatureMin === undefined || point?.temperatureMin === null) return '--';
  if (point?.temperatureMax === undefined || point?.temperatureMax === null) return '--';
  return `${Math.round(point.temperatureMin)}-${Math.round(point.temperatureMax)}°C`;
};

const MarketDetail = () => {
  const { id } = useParams();
  const { search } = useLocation();
  const { t } = useI18n();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const commodity = params.get('commodity') || '';
  const horizon = params.get('horizon') || '7';
  const quantity = params.get('quantity') || '';
  const transportCostPerKm = params.get('transportCostPerKm') || '';
  const [detail, setDetail] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDetail = async () => {
      try {
        setLoading(true);
        if (!commodity) {
          throw new Error('Commodity is required for market detail.');
        }
        const [detailResponse, forecastResponse] = await Promise.all([
          api.get(`/api/markets/${id}`, {
            params: { commodity, horizon, quantity, transportCostPerKm },
          }),
          api.get(`/api/markets/${id}/forecast`, {
            params: { commodity, horizon, quantity, transportCostPerKm },
          }),
        ]);

        setDetail(detailResponse.data);
        setForecast(forecastResponse.data);
      } catch (err) {
        setError(err.response?.data?.error || err.message || t('errorLoading'));
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [id, commodity, horizon, quantity, transportCostPerKm, t]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return <div className="glass-panel p-8 text-rose-700">{error}</div>;
  }

  const anomalies = detail?.anomalies || [];
  const priceHistory = (detail?.priceHistory || []).map((point) => ({
    ...point,
    isAnomaly: anomalies.some((anomaly) => anomaly.date === point.date),
  }));
  const weatherSummary = detail?.weatherSummary || forecast?.weatherSummary;
  const weatherAvailable = weatherSummary?.status && weatherSummary.status !== 'unavailable';
  const weatherTimeline = (forecast?.forecast || []).map((point) => ({
    conditionLabel: point.conditionLabel,
    date: point.forecastDate,
    humidity: point.humidity,
    precipitationMm: point.precipitationMm,
    temperatureMax: point.temperatureMax,
    temperatureMin: point.temperatureMin,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-600">
        <ArrowLeft size={18} />
        Back
      </Link>

      <section className="glass-panel p-8 md:p-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm uppercase tracking-[0.24em] text-primary-600 font-semibold">{t('detailTitle')}</p>
            <h1 className="mt-4 text-4xl font-black text-slate-900">{detail?.market?.name}</h1>
            <p className="mt-2 text-slate-500">{detail?.market?.district}, {detail?.market?.state}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${riskClass(detail?.riskLevel)}`}>
              {t('risk')}: {detail?.riskLevel}
            </span>
            <span className="px-4 py-2 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {t('confidence')}: {detail?.confidenceLabel}
            </span>
            <span className={`px-4 py-2 rounded-full text-sm font-semibold ${weatherImpactClass(detail?.weatherImpactLabel)}`}>
              Weather: {detail?.weatherImpactLabel || 'Unavailable'}
            </span>
          </div>
        </div>

        <div className="mt-8 grid md:grid-cols-5 gap-4">
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{t('latestPrice')}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(detail?.latestPrice)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{t('latestArrival')}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatNumber(detail?.arrivals?.latestArrivalQty)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{t('grossRevenue')}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(forecast?.profitEstimate?.grossRevenue)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">{t('netReturn')}</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(forecast?.profitEstimate?.netReturn)}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">Model</p>
            <p className="mt-2 text-2xl font-black text-slate-900">{forecast?.model?.modelName || 'Unavailable'}</p>
            <p className="mt-1 text-sm text-slate-500">{forecast?.model?.inferenceEngine || '--'}</p>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.35fr_0.65fr] gap-8">
        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">{t('recentHistory')}</h2>
          <div className="h-80 mt-6">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="modalPrice" stroke="#0ea5e9" strokeWidth={3} dot={anomalyDot} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-7">
            <h2 className="text-2xl font-bold text-slate-800">{t('forecast')}</h2>
            <div className="h-64 mt-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={forecast?.forecast || []}>
                  <defs>
                    <linearGradient id="forecastArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="forecastDate" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="predictedPrice" stroke="#16a34a" fill="url(#forecastArea)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 text-sm text-slate-600 space-y-2">
              <p>Average forecast: <span className="font-semibold text-slate-900">{formatCurrency(forecast?.summary?.averageForecastPrice)}</span></p>
              <p>Best sell day: <span className="font-semibold text-slate-900">{forecast?.summary?.bestSellDay?.forecastDate}</span></p>
              <p>Expected change: <span className="font-semibold text-slate-900">{forecast?.summary?.expectedChangePercent}%</span></p>
              <p>Data mode: <span className="font-semibold text-slate-900">{forecast?.dataSource?.mode || detail?.dataSource?.mode || '--'}</span></p>
            </div>
          </div>

          <div className="glass-panel p-7">
            <h2 className="text-2xl font-bold text-slate-800">{t('recentTrend')}</h2>
            <p className="mt-4 text-slate-600">{detail?.trendLabel}</p>
            <div className="mt-4 space-y-3">
              {anomalies.length > 0 ? anomalies.map((anomaly) => (
                <div key={`${anomaly.date}-${anomaly.reason}`} className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 flex items-start gap-3">
                  <AlertTriangle size={16} className="mt-0.5" />
                  <span>{anomaly.date}: {anomaly.reason}</span>
                </div>
              )) : (
                <p className="text-slate-500">{t('noData')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="glass-panel p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-slate-800">{forecast?.forecastHorizon || horizon}-day weather outlook</h2>
          <span className={`px-4 py-2 rounded-full text-sm font-semibold ${weatherImpactClass(detail?.weatherImpactLabel)}`}>
            {detail?.weatherImpactLabel || 'Unavailable'}
          </span>
        </div>

        {weatherAvailable ? (
          <>
            <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-7 gap-3">
              {weatherTimeline.map((point) => (
                <div key={point.date} className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">{point.date}</p>
                  <p className="mt-2 text-lg font-bold text-slate-900">{point.conditionLabel || 'Clear'}</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-600">
                    <div className="flex items-center gap-2">
                      <Thermometer size={14} className="text-emerald-600" />
                      <span>{formatTempBand(point)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CloudRain size={14} className="text-sky-600" />
                      <span>{formatNumber(point.precipitationMm)} mm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets size={14} className="text-cyan-600" />
                      <span>{formatNumber(point.humidity)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-slate-600">
              <p>
                Forecast weather is resolved from {weatherSummary?.resolvedFrom || 'market'} coordinates and aligned with the same 7-day price forecast window.
              </p>
              {weatherSummary?.note ? <p className="mt-2 text-slate-500">{weatherSummary.note}</p> : null}
            </div>
          </>
        ) : (
          <p className="mt-6 text-slate-500">{weatherSummary?.note || 'Live weather is unavailable for this market right now.'}</p>
        )}
      </section>

      <section className="glass-panel p-7">
        <h2 className="text-2xl font-bold text-slate-800">{t('latestArrival')}</h2>
        <div className="h-72 mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="arrivalQty" fill="#6366f1" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
};

export default MarketDetail;
