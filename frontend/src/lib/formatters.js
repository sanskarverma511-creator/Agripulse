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

export const formatDate = (value, language = 'en') => {
  if (!value) return '--';

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === 'hi' ? 'hi-IN' : 'en-IN', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parsed);
};

export const getForecastDisplayDate = (point) => point?.date || point?.forecastDate || null;

const humanizeCommodity = (commodity) => String(commodity || '')
  .split('-')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

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
    sugarcane: { en: 'Sugarcane', hi: '\u0917\u0928\u094d\u0928\u093e' },
  };

  return labels[commodity]?.[language] || humanizeCommodity(commodity);
};

const localizedRiskLevels = {
  High: { en: 'High', hi: '\u0909\u091a\u094d\u091a' },
  Low: { en: 'Low', hi: '\u0915\u092e' },
  Medium: { en: 'Medium', hi: '\u092e\u0927\u094d\u092f\u092e' },
};

const localizedConfidenceLevels = {
  High: { en: 'High', hi: '\u0909\u091a\u094d\u091a' },
  Low: { en: 'Low', hi: '\u0915\u092e' },
  Medium: { en: 'Medium', hi: '\u092e\u0927\u094d\u092f\u092e' },
};

const localizedWeatherImpact = {
  Favorable: { en: 'Favorable', hi: '\u0905\u0928\u0941\u0915\u0942\u0932' },
  Mixed: { en: 'Mixed', hi: '\u092e\u093f\u0936\u094d\u0930\u093f\u0924' },
  Risky: { en: 'Risky', hi: '\u091c\u094b\u0916\u093f\u092e \u092d\u0930\u093e' },
  Unavailable: { en: 'Unavailable', hi: '\u0909\u092a\u0932\u092c\u094d\u0927 \u0928\u0939\u0940\u0902' },
};

const localizedTrend = {
  Cooling: { en: 'Cooling', hi: '\u0917\u093f\u0930\u093e\u0935\u091f \u0915\u0940 \u0913\u0930' },
  'Limited history': { en: 'Limited history', hi: '\u0938\u0940\u092e\u093f\u0924 \u0907\u0924\u093f\u0939\u093e\u0938' },
  Rising: { en: 'Rising', hi: '\u092c\u0922\u093c\u0924 \u092a\u0930' },
  Stable: { en: 'Stable', hi: '\u0938\u094d\u0925\u093f\u0930' },
};

const localizeValue = (value, language, dictionary) => dictionary[value]?.[language] || value || '--';

export const localizeRiskLevel = (value, language = 'en') => localizeValue(value, language, localizedRiskLevels);

export const localizeConfidenceLevel = (value, language = 'en') => localizeValue(value, language, localizedConfidenceLevels);

export const localizeWeatherImpactLabel = (value, language = 'en') => localizeValue(value, language, localizedWeatherImpact);

export const localizeTrendLabel = (value, language = 'en') => localizeValue(value, language, localizedTrend);

export const localizeExplanationLine = (line, language = 'en') => {
  if (language !== 'hi' || !line) {
    return line;
  }

  let match = line.match(/^(.+) is (stable|rising|cooling|limited history) with the latest modal price at (\d+(?:\.\d+)?) INR\/quintal\.$/i);
  if (match) {
    const [, marketName, trend, price] = match;
    const trendKey = trend.toLowerCase() === 'limited history'
      ? 'Limited history'
      : trend.charAt(0).toUpperCase() + trend.slice(1).toLowerCase();
    return `${marketName} ${localizeTrendLabel(trendKey, 'hi')} है और नवीनतम मॉडल मूल्य ${price} INR/क्विंटल है।`;
  }

  match = line.match(/^The 7-day average is (\d+(?:\.\d+)?) INR\/quintal and the model projects (\d+(?:\.\d+)?) next\.$/i);
  if (match) {
    const [, averagePrice, nextPrice] = match;
    return `7-दिन का औसत ${averagePrice} INR/क्विंटल है और मॉडल अगला मूल्य ${nextPrice} अनुमानित करता है।`;
  }

  match = line.match(/^Arrivals are (below|above) the weekly average \((\d+(?:\.\d+)?) vs (\d+(?:\.\d+)?)\), which affects price pressure\.$/i);
  if (match) {
    const [, relation, latestArrival, averageArrival] = match;
    const relationText = relation.toLowerCase() === 'below'
      ? '\u0938\u093e\u092a\u094d\u0924\u093e\u0939\u093f\u0915 \u0914\u0938\u0924 \u0938\u0947 \u0915\u092e'
      : '\u0938\u093e\u092a\u094d\u0924\u093e\u0939\u093f\u0915 \u0914\u0938\u0924 \u0938\u0947 \u0905\u0927\u093f\u0915';
    return `आवक ${relationText} है (${latestArrival} बनाम ${averageArrival}), जिससे मूल्य दबाव प्रभावित होता है।`;
  }

  match = line.match(/^Weather looks favorable for ([a-z-]+) with (\d+(?:\.\d+)?)C average temperature, (\d+(?:\.\d+)?) mm rain, and humidity near (\d+)%\.$/i);
  if (match) {
    const [, commodity, avgTemp, rainfall, humidity] = match;
    return `${commodityLabel(commodity.toLowerCase(), 'hi')} के लिए मौसम अनुकूल दिख रहा है, औसत तापमान ${avgTemp}C, वर्षा ${rainfall} mm और आर्द्रता लगभग ${humidity}% है।`;
  }

  match = line.match(/^Weather may pressure mandi performance for ([a-z-]+): (\d+) heavy-rain day\(s\), (\d+(?:\.\d+)?) mm rain, and humidity near (\d+)%\.$/i);
  if (match) {
    const [, commodity, heavyRainDays, rainfall, humidity] = match;
    return `${commodityLabel(commodity.toLowerCase(), 'hi')} के लिए मौसम मंडी प्रदर्शन पर दबाव डाल सकता है: ${heavyRainDays} भारी वर्षा वाले दिन, ${rainfall} mm वर्षा और लगभग ${humidity}% आर्द्रता।`;
  }

  match = line.match(/^Weather is mixed for ([a-z-]+), with moderate support from temperature but some pressure from rainfall and humidity\.$/i);
  if (match) {
    const [, commodity] = match;
    return `${commodityLabel(commodity.toLowerCase(), 'hi')} के लिए मौसम मिश्रित है, तापमान से कुछ सहारा है लेकिन वर्षा और आर्द्रता से दबाव भी है।`;
  }

  match = line.match(/^Primary model selection is ([a-z_]+) with ([a-z_]+) used during serving\.$/i);
  if (match) {
    const [, modelName, inferenceEngine] = match;
    return `मुख्य मॉडल चयन ${modelName} है और सर्विंग के दौरान ${inferenceEngine} का उपयोग हुआ।`;
  }

  return line;
};

export const riskClass = (riskLevel) => {
  if (riskLevel === 'High') return 'bg-rose-100 text-rose-700';
  if (riskLevel === 'Medium') return 'bg-amber-100 text-amber-700';
  return 'bg-emerald-100 text-emerald-700';
};
