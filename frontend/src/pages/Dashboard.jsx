import React, { useEffect, useState } from 'react';
import { Activity, CloudRain, Database, Leaf, Map, Radar } from 'lucide-react';
import { api } from '../lib/api';
import { formatNumber } from '../lib/formatters';
import { useI18n } from '../context/I18nContext';

const Dashboard = () => {
  const { t } = useI18n();
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/dashboard/summary').then((response) => setData(response.data)).catch(() => setData(null));
  }, []);

  if (!data) {
    return <div className="glass-panel p-8 text-slate-500">{t('noData')}</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in-up">
      <section className="glass-panel p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-primary-600 font-semibold">{t('dashboardTitle')}</p>
        <h1 className="mt-4 text-4xl font-black text-slate-900">{t('healthSummary')}</h1>
        <div className="mt-8 grid md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Map className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">{t('state')}</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.supportedStateCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Leaf className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Active crops</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.activeCommodityCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Database className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">{t('records')}</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.totalRecordsIngested)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Activity className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">{t('totalMarkets')}</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.marketCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Radar className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Forecast snapshots</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.anomalyCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <CloudRain className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Weather cache</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.weatherSnapshotCount)}</p>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8">
        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">State coverage</h2>
          <div className="mt-5 space-y-4">
            {data.states.map((state) => (
              <div key={state.state} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{state.state}</p>
                <p className="text-slate-600 mt-1">{state.districtCount} districts · {state.marketCount} markets</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">{t('modelVersions')}</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-3 pr-4">Commodity</th>
                  <th className="py-3 pr-4">Task</th>
                  <th className="py-3 pr-4">MAPE</th>
                  <th className="py-3 pr-4">RMSE</th>
                </tr>
              </thead>
              <tbody>
                {data.currentModelVersions.map((model) => (
                  <tr key={`${model.commodity}-${model.taskType}`} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 pr-4 font-semibold">{model.commodity}</td>
                    <td className="py-3 pr-4">{model.taskType}</td>
                    <td className="py-3 pr-4">{model.metrics?.mape}</td>
                    <td className="py-3 pr-4">{model.metrics?.rmse}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
