import React from 'react';
import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { useI18n } from '../context/I18nContext';

const Navbar = () => {
  const { language, setLanguage, t } = useI18n();

  return (
    <nav className="sticky top-0 z-50 glass-panel border-b-0 border-x-0 rounded-none bg-white/80 backdrop-blur-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="p-0.5 rounded-xl">
              <img src="/logo.png" alt="AgriPulse Logo" className="w-10 h-10 object-contain" />
            </div>
            <div>
              <Link to="/" className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary-600 to-indigo-600">
                {t('appName')}
              </Link>
              <p className="text-xs text-slate-400">{t('navSubtitle')}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link to="/" className="text-slate-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
              {t('home')}
            </Link>
            <Link to="/dashboard" className="text-slate-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
              {t('dashboard')}
            </Link>
            <Link to="/alerts" className="text-slate-600 hover:text-primary-600 px-3 py-2 rounded-md text-sm font-medium transition-colors">
              {t('alerts')}
            </Link>
            <button
              type="button"
              onClick={() => setLanguage(language === 'en' ? 'hi' : 'en')}
              className="px-3 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-primary-50 hover:text-primary-700 transition-colors"
            >
              {t('changeLanguage')}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
