// API Registry for MAVEN 6.7
// Configured based on user specifications

const KEYS = {
  WORLD_NEWS: import.meta.env.VITE_WORLD_NEWS_API_KEY || 'd9f883fa7e5742029667c5f71390f2d8',
  AVIATIONSTACK: import.meta.env.VITE_AVIATIONSTACK_API_KEY || '22b35e98afc3933b10b8db5251c25752',
  ALPHA_VANTAGE: import.meta.env.VITE_ALPHA_VANTAGE_API_KEY || 'OHQH8R3681KSRIHL',
  POLYGON: import.meta.env.VITE_POLYGON_API_KEY || 'yBcXpEpoxgpSGTXODV78Tmxp5OZ4pDFL',
  FMP: import.meta.env.VITE_FMP_API_KEY || 'kbXFIkfwADavZazPLK6WDQWEMea6zB6B',
};

export const MavenAPIs = {
  // 🌦️ Weather
  weather: {
    openMeteo: async (lat: number, lon: number) => {
      // Working, no API key needed
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
      return res.json();
    },
    noaa: async (lat: number, lon: number) => {
      // Working, no API key needed
      const res = await fetch(`https://api.weather.gov/points/${lat},${lon}`);
      return res.json();
    },
    openWeather: async (lat: number, lon: number, apiKey: string) => {
      // Marked as not working / needs valid key
      const res = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}`);
      return res.json();
    }
  },

  // 📰 News & Events
  news: {
    worldNews: async (query: string) => {
      const res = await fetch(`https://api.worldnewsapi.com/search-news?api-key=${KEYS.WORLD_NEWS}&text=${query}`);
      return res.json();
    }
  },

  // 🗺️ Maps & Routing (Endpoints typically used via SDKs, but providing REST access)
  maps: {
    nominatim: async (query: string) => {
      // OpenStreetMap Forward/Reverse Geocoding
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${query}&format=json`);
      return res.json();
    },
    graphHopper: async (startLat: number, startLon: number, endLat: number, endLon: number, apiKey: string) => {
      const res = await fetch(`https://graphhopper.com/api/1/route?point=${startLat},${startLon}&point=${endLat},${endLon}&key=${apiKey}`);
      return res.json();
    }
  },

  // 🚢 Logistics / Tracking
  logistics: {
    aviationStack: async () => {
      // Note: Free tier is HTTP only, might cause mixed content warnings
      const res = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${KEYS.AVIATIONSTACK}`);
      return res.json();
    },
    openSky: async () => {
      const res = await fetch(`https://opensky-network.org/api/states/all`);
      return res.json();
    },
    adsbExchange: async (url: string) => {
      // Requires specific endpoint and auth headers depending on subscription
      const res = await fetch(url);
      return res.json();
    }
  },

  // 🌍 Economic / Macro
  economic: {
    worldBank: async () => {
      // Working, no API key needed
      const res = await fetch(`https://api.worldbank.org/v2/country/all/indicator/SP.POP.TOTL?format=json`);
      return res.json();
    },
    fred: async (seriesId: string, apiKey: string) => {
      // Needs application / long process
      const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json`);
      return res.json();
    }
  },

  // 📊 Financial Data
  financial: {
    alphaVantage: async (symbol: string) => {
      const res = await fetch(`https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${KEYS.ALPHA_VANTAGE}`);
      return res.json();
    },
    polygon: async (ticker: string) => {
      const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?adjusted=true&apiKey=${KEYS.POLYGON}`);
      return res.json();
    },
    fmp: async (ticker: string) => {
      const res = await fetch(`https://financialmodelingprep.com/api/v3/profile/${ticker}?apikey=${KEYS.FMP}`);
      return res.json();
    }
  },

  // 🌐 Social Sentiment
  social: {
    reddit: async (subreddit: string) => {
      const res = await fetch(`https://www.reddit.com/r/${subreddit}/hot.json`);
      return res.json();
    }
  },

  // 🛰️ Satellite / Earth
  satellite: {
    nasaApod: async (apiKey: string = 'DEMO_KEY') => {
      const res = await fetch(`https://api.nasa.gov/planetary/apod?api_key=${apiKey}`);
      return res.json();
    }
  },

  // ⚠️ Conflict / Disaster
  disaster: {
    gdacs: async () => {
      // GDACS API
      const res = await fetch(`https://www.gdacs.org/gdacsapi/api/events/getmacromap.json`);
      return res.json();
    }
  }
};
