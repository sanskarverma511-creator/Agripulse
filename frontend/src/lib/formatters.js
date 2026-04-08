export const formatCurrency = (value) => {
  if (value === undefined || value === null) return '--';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'INR',
  }).format(value);
};

export const formatNumber = (value) => {
  if (value === undefined || value === null) return '--';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value);
};

export const commodityLabel = (commodity, language = 'en') => {
  const labels = {
    gram: { en: 'Gram', hi: '\u091a\u0928\u093e' },
    maize: { en: 'Maize', hi: '\u092e\u0915\u094d\u0915\u093e' },
    onion: { en: 'Onion', hi: '\u092a\u094d\u092f\u093e\u091c' },
    paddy: { en: 'Paddy', hi: '\u0927\u093e\u0928' },
    potato: { en: 'Potato', hi: '\u0906\u0932\u0942' },
    soybean: { en: 'Soybean', hi: '\u0938\u094b\u092f\u093e\u092c\u0940\u0928' },
    tomato: { en: 'Tomato', hi: '\u091f\u092e\u093e\u091f\u0930' },
    wheat: { en: 'Wheat', hi: '\u0917\u0947\u0939\u0942\u0901' },
  };

  return labels[commodity]?.[language] || commodity;
};

export const riskClass = (riskLevel) => {
  if (riskLevel === 'High') return 'bg-rose-100 text-rose-700';
  if (riskLevel === 'Medium') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};
