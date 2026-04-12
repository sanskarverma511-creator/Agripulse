import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Languages, MapPinned, Sprout } from 'lucide-react';
import { api } from '../lib/api';
import { commodityLabel } from '../lib/formatters';
import { useI18n } from '../context/I18nContext';

const categoryLabel = (category) => String(category || 'other')
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

const Home = () => {
  const navigate = useNavigate();
  const { language, t } = useI18n();
  const [states, setStates] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [commodities, setCommodities] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [form, setForm] = useState({
    commodity: '',
    district: '',
    horizon: '7',
    marketId: '',
    quantity: '',
    state: '',
    transportCostPerKm: '',
  });
  const [loadingMeta, setLoadingMeta] = useState(true);
  const noStateData = !loadingMeta && states.length === 0;

  useEffect(() => {
    const loadStates = async () => {
      setLoadingMeta(true);
      const response = await api.get('/api/states');
      setStates(response.data.states || []);
      setLoadingMeta(false);
    };

    loadStates().catch(() => setLoadingMeta(false));
  }, []);

  useEffect(() => {
    if (!form.state) {
      setDistricts([]);
      setCommodities([]);
      setMarkets([]);
      return;
    }

    const loadStateMeta = async () => {
      const [districtResponse, commodityResponse] = await Promise.all([
        api.get('/api/districts', { params: { state: form.state } }),
        api.get('/api/commodities', { params: { state: form.state } }),
      ]);

      setDistricts(districtResponse.data.districts || []);
      setCommodities(commodityResponse.data.commodities || []);
      setMarkets([]);
    };

    loadStateMeta().catch(() => {
      setDistricts([]);
      setCommodities([]);
      setMarkets([]);
    });
  }, [form.state]);

  useEffect(() => {
    if (!form.state || !form.district) {
      setMarkets([]);
      return;
    }

    api.get('/api/markets', {
      params: {
        commodity: form.commodity || undefined,
        district: form.district,
        state: form.state,
      },
    }).then((response) => {
      setMarkets(response.data.markets || []);
    }).catch(() => setMarkets([]));
  }, [form.state, form.district, form.commodity]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!form.state || !form.district || !form.commodity) return;

    const params = new URLSearchParams({
      commodity: form.commodity,
      district: form.district,
      horizon: form.horizon,
      marketId: form.marketId,
      quantity: form.quantity,
      state: form.state,
      transportCostPerKm: form.transportCostPerKm,
    });

    navigate(`/results?${params.toString()}`);
  };

  return (
    <div className="max-w-6xl mx-auto py-10 space-y-12">
      <section className="grid lg:grid-cols-[1.3fr_0.9fr] gap-8 items-start">
        <div className="glass-panel p-8 md:p-10 animate-fade-in-up">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-700 px-4 py-2 text-sm font-semibold">
            <Sprout size={16} />
            Real-data mandi forecasting workspace
          </div>
          <h1 className="mt-6 text-4xl md:text-5xl font-black text-slate-900 leading-tight">
            {t('searchTitle')}
          </h1>
          <p className="mt-4 text-lg text-slate-600 max-w-2xl">
            {t('searchHint')}
          </p>

          <div className="grid md:grid-cols-3 gap-4 mt-8">
            <div className="rounded-2xl bg-white/75 border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">{t('state')}</p>
              <p className="mt-2 text-lg font-bold text-slate-800">Dynamic Coverage</p>
              <p className="text-sm text-slate-500">States and mandis come from imported market data</p>
            </div>
            <div className="rounded-2xl bg-white/75 border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">{t('forecast')}</p>
              <p className="mt-2 text-lg font-bold text-slate-800">3-14 Days</p>
              <p className="text-sm text-slate-500">Forecast window, best-sell day, and weather effect</p>
            </div>
            <div className="rounded-2xl bg-white/75 border border-slate-200 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400 font-semibold">{t('alerts')}</p>
              <p className="mt-2 text-lg font-bold text-slate-800">Secondary Tooling</p>
              <p className="text-sm text-slate-500">Comparison and alerts remain optional after forecasting</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('selectState')}</label>
              <select
                className="input-field"
                value={form.state}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  commodity: '',
                  district: '',
                  marketId: '',
                  state: event.target.value,
                }))}
                disabled={loadingMeta}
              >
                <option value="">{noStateData ? 'No states available yet' : t('selectState')}</option>
                {states.map((state) => <option key={state} value={state}>{state}</option>)}
              </select>
              {noStateData ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  No mandi data has been loaded yet. Import CSV files or run the demo seed first, then refresh this page.
                </div>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('selectDistrict')}</label>
              <select
                className="input-field"
                value={form.district}
                onChange={(event) => setForm((current) => ({ ...current, district: event.target.value, marketId: '' }))}
                disabled={!form.state}
              >
                <option value="">{t('selectDistrict')}</option>
                {districts.map((district) => <option key={district} value={district}>{district}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">{t('selectCommodity')}</label>
              <select
                className="input-field"
                value={form.commodity}
                onChange={(event) => setForm((current) => ({ ...current, commodity: event.target.value, marketId: '' }))}
                disabled={!form.state}
              >
                <option value="">{t('selectCommodity')}</option>
                {commodities.map((commodity) => (
                  <option key={commodity.id} value={commodity.id}>
                    {`${commodity.labelHi && language === 'hi' ? commodity.labelHi : commodity.label || commodityLabel(commodity.id, language)} (${categoryLabel(commodity.category)})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Specific mandi (optional)</label>
              <select
                className="input-field"
                value={form.marketId}
                onChange={(event) => setForm((current) => ({ ...current, marketId: event.target.value }))}
                disabled={!form.state || !form.district}
              >
                <option value="">Best mandi in selected region</option>
                {markets.map((market) => (
                  <option key={market.id} value={market.id}>
                    {market.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('quantity')}</label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.quantity}
                  onChange={(event) => setForm((current) => ({ ...current, quantity: event.target.value }))}
                  placeholder="12"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Forecast horizon</label>
                <select
                  className="input-field"
                  value={form.horizon}
                  onChange={(event) => setForm((current) => ({ ...current, horizon: event.target.value }))}
                >
                  <option value="7">7 days</option>
                  <option value="10">10 days</option>
                  <option value="14">14 days</option>
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">{t('transportCost')}</label>
                <input
                  className="input-field"
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.transportCostPerKm}
                  onChange={(event) => setForm((current) => ({ ...current, transportCostPerKm: event.target.value }))}
                  placeholder="18"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full btn-primary justify-center text-base"
              disabled={!form.state || !form.district || !form.commodity}
            >
              {t('searchButton')}
            </button>
          </form>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-5">
        <div className="glass-panel p-6">
          <MapPinned className="text-primary-600" />
          <h3 className="mt-4 text-xl font-bold text-slate-800">Forecast before selling</h3>
          <p className="mt-2 text-slate-600">Choose a crop and region, then inspect the future price window before making a sale.</p>
        </div>
        <div className="glass-panel p-6">
          <ArrowRightLeft className="text-primary-600" />
          <h3 className="mt-4 text-xl font-bold text-slate-800">{t('compareTitle')}</h3>
          <p className="mt-2 text-slate-600">Compare mandis on forecasted price, best sell day, risk, and estimated return.</p>
        </div>
        <div className="glass-panel p-6">
          <Languages className="text-primary-600" />
          <h3 className="mt-4 text-xl font-bold text-slate-800">{t('languageLabel')}</h3>
          <p className="mt-2 text-slate-600">Farmer-friendly interface in English and Hindi for project demo and viva.</p>
        </div>
      </section>
    </div>
  );
};

export default Home;
