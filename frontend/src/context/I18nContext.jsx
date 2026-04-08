import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations';

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => localStorage.getItem('agri-lang') || 'en');

  useEffect(() => {
    localStorage.setItem('agri-lang', language);
  }, [language]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    t: (key) => translations[language][key] || translations.en[key] || key,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return context;
};
