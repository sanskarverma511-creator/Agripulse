import React, { useEffect, useState } from 'react';
import { Activity, CloudRain, Database, FileSpreadsheet, Leaf, Map, Radar } from 'lucide-react';
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
        <h1 className="mt-4 text-4xl font-black text-slate-900">Real-data forecasting health</h1>
        <div className="mt-8 grid md:grid-cols-4 xl:grid-cols-8 gap-4">
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Map className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">{t('state')}</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.supportedStateCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Leaf className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Eligible non-MSP crops</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.eligibleNonMspCommodityCount ?? data.activeCommodityCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Leaf className="text-rose-500" />
            <p className="mt-4 text-sm text-slate-500">Excluded MSP crops</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.excludedMspCommodityCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Database className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Real records</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.realDataRecordCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <Activity className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">{t('totalMarkets')}</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.marketCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <FileSpreadsheet className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Downloaded files</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.downloadedFileCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <CloudRain className="text-primary-600" />
            <p className="mt-4 text-sm text-slate-500">Weather history</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(data.weatherHistoryCount)}</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-slate-200 p-5">
            <FileSpreadsheet className="text-amber-600" />
            <p className="mt-4 text-sm text-slate-500">Staged rows</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber((data.stagedPriceCount || 0) + (data.stagedWeatherCount || 0))}</p>
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
                <p className="text-slate-600 mt-1">{state.districtCount} districts - {state.marketCount} markets</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">Model comparison</h2>
          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500 border-b border-slate-200">
                  <th className="py-3 pr-4">Commodity</th>
                  <th className="py-3 pr-4">Model</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">MAPE</th>
                  <th className="py-3 pr-4">RMSE</th>
                  <th className="py-3 pr-4">Rows</th>
                </tr>
              </thead>
              <tbody>
                {data.currentModelVersions.map((model) => (
                  <tr key={`${model.commodity}-${model.modelName}`} className="border-b border-slate-100 text-slate-700">
                    <td className="py-3 pr-4 font-semibold">{model.commodity}</td>
                    <td className="py-3 pr-4">{model.modelName}</td>
                    <td className="py-3 pr-4">{model.isActive ? 'selected' : model.status}</td>
                    <td className="py-3 pr-4">{model.metrics?.mape ?? '--'}</td>
                    <td className="py-3 pr-4">{model.metrics?.rmse ?? '--'}</td>
                    <td className="py-3 pr-4">{formatNumber(model.trainingData?.rowCountUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8">
        <div className="glass-panel p-7">
          <div className="flex items-center gap-3">
            <Radar className="text-primary-600" />
            <h2 className="text-2xl font-bold text-slate-800">Source breakdown</h2>
          </div>
          <div className="mt-5 space-y-3">
            {data.sourceBreakdown.map((entry) => (
              <div key={entry.source} className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between gap-4">
                <p className="font-semibold text-slate-900">{entry.source}</p>
                <p className="text-slate-600">{formatNumber(entry.count)} rows</p>
              </div>
            ))}
            <div className="rounded-2xl bg-emerald-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Official certified</p>
              <p className="text-slate-600">{formatNumber(data.officialRecordCount)} rows</p>
            </div>
            <div className="rounded-2xl bg-sky-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Approved public</p>
              <p className="text-slate-600">{formatNumber(data.approvedPublicRecordCount)} rows</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Official files</p>
              <p className="text-slate-600">{formatNumber(data.officialDownloadedFileCount)}</p>
            </div>
            <div className="rounded-2xl bg-violet-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Public staged files</p>
              <p className="text-slate-600">{formatNumber(data.publicStagedFileCount + data.publicWeatherFileCount)}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">Recent imports</h2>
          <div className="mt-5 space-y-4">
            {(data.recentImports || []).length === 0 ? (
              <p className="text-slate-500">No import runs recorded yet.</p>
            ) : data.recentImports.map((run) => (
              <div key={`${run.sourceName}-${run.createdAt}`} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{run.sourceName}</p>
                <p className="mt-1 text-slate-600">{run.states.join(', ') || 'Unknown state set'}</p>
                <p className="mt-2 text-sm text-slate-500">
                  Prices: {formatNumber(run.insertedRows + run.updatedRows)} - Weather: {formatNumber(run.importedWeatherRows)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Eligible: {formatNumber(run.eligibleNonMspRows)} - Excluded MSP: {formatNumber(run.excludedMspRows)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid lg:grid-cols-[0.9fr_1.1fr] gap-8">
        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">Pipeline health</h2>
          <div className="mt-5 space-y-3">
            <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Certified rows</p>
              <p className="text-slate-600">{formatNumber(data.certifiedRecordCount)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Quarantined files</p>
              <p className="text-slate-600">{formatNumber(data.quarantinedFileCount)}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-4 flex items-center justify-between gap-4">
              <p className="font-semibold text-slate-900">Quarantined rows</p>
              <p className="text-slate-600">{formatNumber(data.quarantineRowCount)}</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-7">
          <h2 className="text-2xl font-bold text-slate-800">Training coverage</h2>
          <div className="mt-5 space-y-4">
            {data.currentModelVersions.length === 0 ? (
              <p className="text-slate-500">No trained model metadata yet.</p>
            ) : data.currentModelVersions.slice(0, 6).map((model) => (
              <div key={`${model.commodity}-${model.modelName}-coverage`} className="rounded-2xl bg-slate-50 p-4">
                <p className="text-lg font-bold text-slate-900">{model.commodity} / {model.modelName}</p>
                <p className="mt-1 text-slate-600">
                  Window: {model.trainingData?.coverageWindow?.minDate || '--'} to {model.trainingData?.coverageWindow?.maxDate || '--'}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Official: {model.trainingData?.officialPercent ?? '--'}% - Approved public: {model.trainingData?.approvedPublicPercent ?? '--'}% - Weather coverage: {model.trainingData?.weatherCoveragePercent ?? '--'}%
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Dashboard;
