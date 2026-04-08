import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BellPlus,
  ChevronLeft,
  CloudRain,
  Droplets,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import { commodityLabel, formatCurrency, formatNumber, riskClass } from '../lib/formatters';
import { useI18n } from '../context/I18nContext';

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

const Results = () => {
  const { search } = useLocation();
  const { language, t } = useI18n();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alertStatus, setAlertStatus] = useState('');
  const [alertForm, setAlertForm] = useState({ direction: 'above', targetPrice: '' });

  const requestPayload = {
    commodity: params.get('commodity') || '',
    district: params.get('district') || '',
    quantity: params.get('quantity') || '',
    state: params.get('state') || '',
    transportCostPerKm: params.get('transportCostPerKm') || '',
  };

  useEffect(() => {
    const loadRecommendation = async () => {
      try {
        setLoading(true);
        const response = await api.post('/api/recommendations', requestPayload);
        setData(response.data);
        setAlertForm((current) => ({
          ...current,
          targetPrice: String(Math.round(response.data.predictedPrice || 0)),
        }));
      } catch (err) {
        setError(err.response?.data?.error || t('errorLoading'));
      } finally {
        setLoading(false);
      }
    };

    if (!requestPayload.state || !requestPayload.district || !requestPayload.commodity) {
      setError(t('errorLoading'));
      setLoading(false);
      return;
    }

    loadRecommendation();
  }, [search, t]);

  const createAlert = async () => {
    try {
      setAlertStatus('');
      await api.post('/api/alerts', {
        commodity: requestPayload.commodity,
        direction: alertForm.direction,
        district: requestPayload.district,
        marketId: data?.bestMarketId,
        state: requestPayload.state,
        targetPrice: Number(alertForm.targetPrice),
      });
      setAlertStatus('Alert created successfully.');
    } catch (err) {
      setAlertStatus(err.response?.data?.error || 'Could not create alert.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-8 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-8 border-primary-500 rounded-full border-t-transparent animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-700 animate-pulse">Running recommendation engine...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 border border-rose-200 bg-rose-50/80">
        <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-600 mb-6">
          <ChevronLeft size={18} />
          {t('home')}
        </Link>
        <div className="flex items-start gap-4 text-rose-700">
          <AlertCircle className="mt-1" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const bestMarket = data?.topMarkets?.[0];
  const weatherSummary = data?.weatherSummary;
  const todayWeather = weatherSummary?.current;
  const weatherWindow = weatherSummary?.window;
  const weatherAvailable = weatherSummary?.status && weatherSummary.status !== 'unavailable';

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-600">
        <ChevronLeft size={18} />
        {t('home')}
      </Link>

      <section className="glass-panel p-8 md:p-10">
        <p className="text-sm uppercase tracking-[0.24em] text-primary-600 font-semibold">{t('bestMarket')}</p>
        <div className="mt-5 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-4 py-2 text-sm font-semibold">
              <TrendingUp size={16} />
              {requestPayload.state} / {requestPayload.district}
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-black text-slate-900">{data?.bestMarketName}</h1>
            <p className="mt-3 text-lg text-slate-600">
              {commodityLabel(requestPayload.commodity, language)} · {requestPayload.district}, {requestPayload.state}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${riskClass(data?.riskLevel)}`}>
                {t('risk')}: {data?.riskLevel}
              </span>
              <span className="px-4 py-2 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {t('confidence')}: {data?.confidenceLabel}
              </span>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${weatherImpactClass(data?.weatherImpactLabel)}`}>
                Weather: {data?.weatherImpactLabel || 'Unavailable'}
              </span>
              <span className="px-4 py-2 rounded-full text-sm font-semibold bg-primary-50 text-primary-700">
                Scope: {data?.searchScope}
              </span>
            </div>
            <ul className="mt-6 space-y-3 text-slate-600">
              {(data?.explanation || []).map((line) => <li key={line}>• {line}</li>)}
            </ul>
          </div>

          <div className="rounded-3xl bg-slate-900 text-white p-7 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{t('predictedPrice')}</p>
            <p className="mt-3 text-5xl font-black">{formatCurrency(data?.predictedPrice)}</p>
            <p className="mt-2 text-slate-400">per quintal</p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-slate-400">{t('grossRevenue')}</p>
                <p className="mt-2 font-bold">{formatCurrency(bestMarket?.grossRevenue)}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-slate-400">{t('netReturn')}</p>
                <p className="mt-2 font-bold">{formatCurrency(bestMarket?.netReturn)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">Weather outlook</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${weatherImpactClass(data?.weatherImpactLabel)}`}>
                  {data?.weatherImpactLabel || 'Unavailable'}
                </span>
              </div>
              {weatherAvailable ? (
                <>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Thermometer size={14} />
                        <span>Today</span>
                      </div>
                      <p className="mt-2 font-semibold text-white">{formatTempBand(todayWeather)}</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="flex items-center gap-2 text-slate-300">
                        <CloudRain size={14} />
                        <span>Rain</span>
                      </div>
                      <p className="mt-2 font-semibold text-white">{formatNumber(weatherWindow?.totalPrecipitation)} mm</p>
                    </div>
                    <div className="rounded-xl bg-white/10 p-3">
                      <div className="flex items-center gap-2 text-slate-300">
                        <Droplets size={14} />
                        <span>Humidity</span>
                      </div>
                      <p className="mt-2 font-semibold text-white">{formatNumber(weatherWindow?.averageHumidity)}%</p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">
                    {todayWeather?.conditionLabel || weatherSummary?.conditionLabel} outlook from {weatherSummary?.resolvedFrom || 'market'} coordinates.
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-300">{weatherSummary?.note || 'Live weather is unavailable for this market right now.'}</p>
              )}
              {weatherSummary?.note && weatherAvailable ? (
                <p className="text-xs text-slate-400">{weatherSummary.note}</p>
              ) : null}
            </div>

            <Link
              to={`/market/${data?.bestMarketId}?commodity=${requestPayload.commodity}&quantity=${requestPayload.quantity || ''}&transportCostPerKm=${requestPayload.transportCostPerKm || ''}`}
              className="mt-8 block text-center py-3 rounded-2xl bg-white text-slate-900 font-semibold hover:bg-primary-100 transition-colors"
            >
              {t('marketDetails')}
            </Link>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8">
        <div className="glass-panel p-7">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-slate-800">{t('compareTitle')}</h2>
            <span className="text-sm text-slate-500">{t('topMarkets')}</span>
          </div>
          <div className="space-y-4">
            {(data?.topMarkets || []).map((market) => (
              <div key={market.marketId} className="rounded-2xl border border-slate-200 bg-white/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{market.marketName}</h3>
                    <p className="mt-1 text-slate-500">{market.recentTrend} · {t('risk')}: {market.riskLevel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary-700">{formatCurrency(market.predictedPrice)}</p>
                    <p className="text-sm text-slate-400">Arrival {formatNumber(market.arrivalQty)} qtl</p>
                  </div>
                </div>
                <div className="mt-4 grid sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('confidence')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{market.confidenceLabel}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('grossRevenue')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{formatCurrency(market.grossRevenue)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('netReturn')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{formatCurrency(market.netReturn)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">Weather</p>
                    <p className={`mt-1 inline-flex px-2 py-1 rounded-full font-semibold ${weatherImpactClass(market.weatherImpactLabel)}`}>
                      {market.weatherImpactLabel || 'Unavailable'}
                    </p>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                  {market.weatherSummary?.status && market.weatherSummary.status !== 'unavailable' ? (
                    <p>
                      {market.weatherSummary?.conditionLabel || 'Clear'} · Rain {formatNumber(market.weatherSummary?.window?.totalPrecipitation)} mm · Humidity {formatNumber(market.weatherSummary?.window?.averageHumidity)}%
                    </p>
                  ) : (
                    <p>{market.weatherSummary?.note || 'Weather data unavailable for this market.'}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className="glass-panel p-7">
            <h2 className="text-2xl font-bold text-slate-800">{t('forecast')}</h2>
            <div className="mt-5 space-y-3 text-slate-600">
              <p>Average: <span className="font-semibold text-slate-900">{formatCurrency(data?.forecastSummary?.averageForecastPrice)}</span></p>
              <p>Best day: <span className="font-semibold text-slate-900">{data?.forecastSummary?.bestSellDay?.forecastDate}</span></p>
              <p>Expected change: <span className="font-semibold text-slate-900">{data?.forecastSummary?.expectedChangePercent}%</span></p>
            </div>
          </div>

          <div className="glass-panel p-7">
            <h2 className="text-2xl font-bold text-slate-800">{t('createAlert')}</h2>
            <div className="mt-5 space-y-4">
              <input
                className="input-field"
                type="number"
                min="0"
                value={alertForm.targetPrice}
                onChange={(event) => setAlertForm((current) => ({ ...current, targetPrice: event.target.value }))}
                placeholder={t('targetPrice')}
              />
              <select
                className="input-field"
                value={alertForm.direction}
                onChange={(event) => setAlertForm((current) => ({ ...current, direction: event.target.value }))}
              >
                <option value="above">Above target</option>
                <option value="below">Below target</option>
              </select>
              <button type="button" onClick={createAlert} className="w-full btn-primary justify-center">
                <BellPlus size={18} />
                {t('createAlert')}
              </button>
              {alertStatus && <p className="text-sm text-slate-500">{alertStatus}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Results;
