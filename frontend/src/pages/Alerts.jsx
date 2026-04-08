import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/formatters';
import { useI18n } from '../context/I18nContext';

const Alerts = () => {
  const { t } = useI18n();
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    api.get('/api/alerts').then((response) => setAlerts(response.data.alerts || [])).catch(() => setAlerts([]));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in-up">
      <section className="glass-panel p-8">
        <p className="text-sm uppercase tracking-[0.24em] text-primary-600 font-semibold">{t('watchlist')}</p>
        <h1 className="mt-4 text-4xl font-black text-slate-900">{t('alerts')}</h1>
        <p className="mt-3 text-slate-600">Alerts created from recommendation results are stored here.</p>
      </section>

      <section className="space-y-4">
        {alerts.length === 0 ? (
          <div className="glass-panel p-8 text-slate-500">{t('noAlerts')}</div>
        ) : alerts.map((alert) => (
          <div key={alert._id} className="glass-panel p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">{alert.commodityLabel}</h2>
                <p className="mt-1 text-slate-500">{alert.district}, {alert.state}</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-primary-700">{formatCurrency(alert.targetPrice)}</p>
                <p className="text-sm text-slate-400">{alert.direction} · {alert.status}</p>
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
};

export default Alerts;
