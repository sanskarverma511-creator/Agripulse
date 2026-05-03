import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  AlertCircle,
  BellPlus,
  ChevronLeft,
  CloudRain,
  Database,
  Droplets,
  Thermometer,
  TrendingUp,
} from 'lucide-react';
import { api } from '../lib/api';
import {
  commodityLabel,
  formatCurrency,
  formatDate,
  formatNumber,
  getForecastDisplayDate,
  localizeConfidenceLevel,
  localizeExplanationLine,
  localizeRiskLevel,
  localizeTrendLabel,
  localizeWeatherImpactLabel,
  riskClass,
} from '../lib/formatters';
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
  return `${Math.round(point.temperatureMin)}-${Math.round(point.temperatureMax)} C`;
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
    horizon: params.get('horizon') || '7',
    marketId: params.get('marketId') || '',
    quantity: params.get('quantity') || '',
    state: params.get('state') || '',
    transportCostPerKm: params.get('transportCostPerKm') || '',
  };

  useEffect(() => {
    const loadForecast = async () => {
      try {
        setLoading(true);
        const response = await api.post('/api/forecast/search', requestPayload);
        setData(response.data);
        setAlertForm((current) => ({
          ...current,
          targetPrice: String(Math.round(response.data.summary?.bestSellDay?.predictedPrice || 0)),
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

    loadForecast();
  }, [search, t]);

  const createAlert = async () => {
    try {
      setAlertStatus('');
      await api.post('/api/alerts', {
        commodity: requestPayload.commodity,
        direction: alertForm.direction,
        district: requestPayload.district,
        marketId: data?.primaryMarketId,
        state: requestPayload.state,
        targetPrice: Number(alertForm.targetPrice),
      });
      setAlertStatus(t('alertCreated'));
    } catch (err) {
      setAlertStatus(err.response?.data?.error || t('alertCreateFailed'));
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="relative w-24 h-24">
          <div className="absolute inset-0 border-8 border-slate-200 rounded-full" />
          <div className="absolute inset-0 border-8 border-primary-500 rounded-full border-t-transparent animate-spin" />
        </div>
        <h2 className="text-2xl font-bold text-slate-700 animate-pulse">{t('runningForecast')}</h2>
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

  const weatherSummary = data?.weatherSummary;
  const todayWeather = weatherSummary?.current;
  const weatherWindow = weatherSummary?.window;
  const weatherAvailable = weatherSummary?.status && weatherSummary.status !== 'unavailable';
  const bestSellDay = data?.summary?.bestSellDay;
  const bestSellDisplayDate = formatDate(getForecastDisplayDate(bestSellDay), language);

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-primary-600">
        <ChevronLeft size={18} />
        {t('home')}
      </Link>

      <section className="glass-panel p-8 md:p-10">
        <p className="text-sm uppercase tracking-[0.24em] text-primary-600 font-semibold">{t('forecastSummary')}</p>
        <div className="mt-5 grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-4 py-2 text-sm font-semibold">
              <TrendingUp size={16} />
              {requestPayload.state} / {requestPayload.district}
            </div>
            <h1 className="mt-5 text-4xl md:text-5xl font-black text-slate-900">{data?.primaryMarketName}</h1>
            <p className="mt-3 text-lg text-slate-600">
              {commodityLabel(requestPayload.commodity, language)} - {requestPayload.district}, {requestPayload.state}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${riskClass(data?.riskLevel)}`}>
                {t('risk')}: {localizeRiskLevel(data?.riskLevel, language)}
              </span>
              <span className="px-4 py-2 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {t('confidence')}: {localizeConfidenceLevel(data?.confidenceLabel, language)}
              </span>
              <span className={`px-4 py-2 rounded-full text-sm font-semibold ${weatherImpactClass(data?.weatherImpactLabel)}`}>
                {t('weather')}: {localizeWeatherImpactLabel(data?.weatherImpactLabel || 'Unavailable', language)}
              </span>
              <span className="px-4 py-2 rounded-full text-sm font-semibold bg-primary-50 text-primary-700">
                {t('window')}: {data?.forecastHorizon} {language === 'hi' ? 'दिन' : 'days'}
              </span>
            </div>
            <ul className="mt-6 space-y-3 text-slate-600">
              {(data?.explanation || []).map((line) => <li key={line}>- {localizeExplanationLine(line, language)}</li>)}
            </ul>
          </div>

          <div className="rounded-3xl bg-slate-900 text-white p-7 shadow-2xl">
            <p className="text-sm uppercase tracking-[0.24em] text-slate-400">{t('predictedPrice')}</p>
            <p className="mt-3 text-5xl font-black">{formatCurrency(bestSellDay?.predictedPrice)}</p>
            <p className="mt-2 text-slate-400">{t('bestProjectedDayHint')}</p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-slate-400">{t('bestSellDay')}</p>
                <p className="mt-2 font-bold">{bestSellDisplayDate}</p>
              </div>
              <div className="rounded-2xl bg-white/10 p-4">
                <p className="text-slate-400">{t('averageForecast')}</p>
                <p className="mt-2 font-bold">{formatCurrency(data?.summary?.averageForecastPrice)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white/10 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">{t('modelWeatherContext')}</p>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${weatherImpactClass(data?.weatherImpactLabel)}`}>
                  {localizeWeatherImpactLabel(data?.weatherImpactLabel || 'Unavailable', language)}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Database size={14} />
                    <span>{t('model')}</span>
                  </div>
                  <p className="mt-2 font-semibold text-white">{data?.model?.modelName || '--'}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <Thermometer size={14} />
                    <span>{t('currentDay')}</span>
                  </div>
                  <p className="mt-2 font-semibold text-white">{formatTempBand(todayWeather)}</p>
                </div>
                <div className="rounded-xl bg-white/10 p-3">
                  <div className="flex items-center gap-2 text-slate-300">
                    <CloudRain size={14} />
                    <span>{t('rainfall')}</span>
                  </div>
                  <p className="mt-2 font-semibold text-white">{formatNumber(weatherWindow?.totalPrecipitation)} mm</p>
                </div>
              </div>
              {weatherAvailable ? (
                <p className="text-sm text-slate-300">
                  {todayWeather?.conditionLabel || weatherSummary?.conditionLabel} {language === 'hi' ? 'स्थिति, आर्द्रता लगभग' : 'outlook with humidity around'} {formatNumber(weatherWindow?.averageHumidity)}%.
                </p>
              ) : (
                <p className="text-sm text-slate-300">{weatherSummary?.note || t('liveWeatherUnavailable')}</p>
              )}
            </div>

            <Link
              to={`/market/${data?.primaryMarketId}?commodity=${requestPayload.commodity}&horizon=${requestPayload.horizon || ''}&quantity=${requestPayload.quantity || ''}&transportCostPerKm=${requestPayload.transportCostPerKm || ''}`}
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
            <h2 className="text-2xl font-bold text-slate-800">{t('mandiComparison')}</h2>
            <span className="text-sm text-slate-500">{data?.comparisonSummary?.searchScope}</span>
          </div>
          <div className="space-y-4">
            {(data?.comparedMarkets || []).map((market) => (
              <div key={market.marketId} className="rounded-2xl border border-slate-200 bg-white/80 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">{market.marketName}</h3>
                    <p className="mt-1 text-slate-500">{localizeTrendLabel(market.recentTrend, language)} - {t('risk')}: {localizeRiskLevel(market.riskLevel, language)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-primary-700">{formatCurrency(market.predictedPrice)}</p>
                    <p className="text-sm text-slate-400">{t('arrivalShort')} {formatNumber(market.arrivalQty)} qtl</p>
                  </div>
                </div>
                <div className="mt-4 grid sm:grid-cols-4 gap-3 text-sm">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('confidence')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{localizeConfidenceLevel(market.confidenceLabel, language)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('model')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{market.model?.modelName || '--'}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('grossRevenue')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{formatCurrency(market.grossRevenue)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-slate-500">{t('netReturn')}</p>
                    <p className="mt-1 font-semibold text-slate-800">{formatCurrency(market.netReturn)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-600">
                  <p>{t('bestSellDay')}: <span className="font-semibold text-slate-900">{formatDate(getForecastDisplayDate(market.forecastSummary?.bestSellDay), language)}</span></p>
                  <p>{t('averageForecast')}: <span className="font-semibold text-slate-900">{formatCurrency(market.forecastSummary?.averageForecastPrice)}</span></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">{t('forecast')}</h2>
          <div className="mt-5 space-y-3 text-slate-600">
            <p>{t('average')}: <span className="font-semibold text-slate-900">{formatCurrency(data?.summary?.averageForecastPrice)}</span></p>
            <p>{t('bestDay')}: <span className="font-semibold text-slate-900">{bestSellDisplayDate}</span></p>
            <p>{t('expectedChange')}: <span className="font-semibold text-slate-900">{data?.summary?.expectedChangePercent}%</span></p>
            <p>{t('dataMode')}: <span className="font-semibold text-slate-900">{data?.dataSource?.mode || '--'}</span></p>
          </div>
        </div>

        <div className="glass-panel p-7">
            <h2 className="text-2xl font-bold text-slate-800">{t('weatherInfluence')}</h2>
            <div className="mt-5 space-y-3 text-slate-600">
              <p className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${weatherImpactClass(data?.weatherImpactLabel)}`}>
                {localizeWeatherImpactLabel(data?.weatherImpactLabel || 'Unavailable', language)}
              </p>
              <p>{t('humidity')}: <span className="font-semibold text-slate-900">{formatNumber(weatherWindow?.averageHumidity)}%</span></p>
              <p>{t('rainfall')}: <span className="font-semibold text-slate-900">{formatNumber(weatherWindow?.totalPrecipitation)} mm</span></p>
              <p>{t('temperature')}: <span className="font-semibold text-slate-900">{formatTempBand(todayWeather)}</span></p>
              {weatherSummary?.note ? <p className="text-sm text-slate-500">{weatherSummary.note}</p> : null}
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
                <option value="above">{t('targetDirectionAbove')}</option>
                <option value="below">{t('targetDirectionBelow')}</option>
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
