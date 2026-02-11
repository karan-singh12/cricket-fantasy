const translate = require('translate-google');
const { getLanguage } = require('./responseMsg');

const translationCache = new Map();  // This lives only in-memory

async function translateTo(text, targetLang = 'bn') {
  if (!text) return text; // skip empty

  const finalLang = targetLang.toLowerCase() === 'hn' ? 'hi' : targetLang.toLowerCase();
  const cacheKey = `${text}::${finalLang}`;

  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  try {
    const result = await translate(text, { to: finalLang });
    translationCache.set(cacheKey, result);
    return result;
  } catch (err) {
    console.error('Translation error:', err);
    return text; // fallback: return original
  }
}

async function translateNamesRecursively(data, targetLang) {
  if (!targetLang) {
    const lang = getLanguage();
    targetLang = lang ? lang.toLowerCase() : 'en';
    if (targetLang === 'hn') targetLang = 'hi';
  }

  if (Array.isArray(data)) {
    return Promise.all(data.map(item => translateNamesRecursively(item, targetLang)));
  } else if (typeof data === 'object' && data !== null) {
    const entries = await Promise.all(
      Object.entries(data).map(async ([key, value]) => {
        if (key === 'name' || key === 'tournament_name') {
          const translatedValue = await translateTo(value, targetLang);
          return [key, translatedValue];
        } else if (typeof value === 'object') {
          const translatedNested = await translateNamesRecursively(value, targetLang);
          return [key, translatedNested];
        } else {
          return [key, value];
        }
      })
    );
    return Object.fromEntries(entries);
  } else {
    return data;
  }
}

module.exports = {
  translateTo,
  translateNamesRecursively,
  translationCache
};
