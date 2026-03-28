import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());

// --- API Routes ---

const ports = [
  { id: 'PRT-SG', name: 'Port of Singapore', lat: 1.26, lng: 103.83 },
  { id: 'PRT-LA', name: 'Port of Los Angeles', lat: 33.72, lng: -118.26 },
  { id: 'PRT-SH', name: 'Port of Shanghai', lat: 31.22, lng: 121.48 },
  { id: 'PRT-NY', name: 'Port of New York', lat: 40.67, lng: -74.02 },
  { id: 'PRT-RT', name: 'Port of Rotterdam', lat: 51.95, lng: 4.05 },
  { id: 'PRT-DB', name: 'Port of Dubai', lat: 25.01, lng: 55.06 },
  { id: 'PRT-HK', name: 'Port of Hong Kong', lat: 22.33, lng: 114.13 },
  { id: 'PRT-BS', name: 'Port of Busan', lat: 35.10, lng: 129.04 },
];

const airports = [
  { id: 'APT-JFK', name: 'JFK New York', lat: 40.64, lng: -73.77 },
  { id: 'APT-LHR', name: 'LHR London', lat: 51.47, lng: -0.45 },
  { id: 'APT-CDG', name: 'CDG Paris', lat: 49.00, lng: 2.55 },
  { id: 'APT-DXB', name: 'DXB Dubai', lat: 25.25, lng: 55.36 },
  { id: 'APT-HND', name: 'HND Tokyo', lat: 35.54, lng: 139.77 },
  { id: 'APT-FRA', name: 'FRA Frankfurt', lat: 50.03, lng: 8.57 },
  { id: 'APT-LAX', name: 'LAX Los Angeles', lat: 33.94, lng: -118.40 },
  { id: 'APT-SIN', name: 'SIN Singapore', lat: 1.36, lng: 103.99 },
];

const cities = [
  { id: 'CTY-NY', name: 'New York Hub', lat: 40.71, lng: -74.00 },
  { id: 'CTY-CHI', name: 'Chicago Hub', lat: 41.87, lng: -87.62 },
  { id: 'CTY-DAL', name: 'Dallas Hub', lat: 32.77, lng: -96.79 },
  { id: 'CTY-LA', name: 'Los Angeles Hub', lat: 34.05, lng: -118.24 },
  { id: 'CTY-BER', name: 'Berlin Hub', lat: 52.52, lng: 13.40 },
  { id: 'CTY-PAR', name: 'Paris Hub', lat: 48.85, lng: 2.35 },
  { id: 'CTY-MAD', name: 'Madrid Hub', lat: 40.41, lng: -3.70 },
  { id: 'CTY-ROM', name: 'Rome Hub', lat: 41.90, lng: 12.49 },
];

const landRoutes = [
  { o: 'CTY-NY', d: 'CTY-CHI' },
  { o: 'CTY-CHI', d: 'CTY-DAL' },
  { o: 'CTY-DAL', d: 'CTY-LA' },
  { o: 'CTY-NY', d: 'CTY-DAL' },
  { o: 'CTY-BER', d: 'CTY-PAR' },
  { o: 'CTY-PAR', d: 'CTY-MAD' },
  { o: 'CTY-PAR', d: 'CTY-ROM' },
  { o: 'CTY-BER', d: 'CTY-ROM' },
];

const riskZones = [
  { id: 'RZ-1', name: 'South China Sea Storm', type: 'weather', lat: 15.0, lng: 115.0, radius: 800, severity: 'high' },
  { id: 'RZ-2', name: 'Red Sea Conflict', type: 'geopolitical', lat: 20.0, lng: 38.0, radius: 1000, severity: 'critical' },
  { id: 'RZ-3', name: 'Panama Canal Drought', type: 'infrastructure', lat: 9.1, lng: -79.7, radius: 400, severity: 'high' },
  { id: 'RZ-4', name: 'Black Sea Blockade', type: 'geopolitical', lat: 43.0, lng: 34.0, radius: 600, severity: 'critical' },
  { id: 'RZ-5', name: 'European Port Strikes', type: 'infrastructure', lat: 51.5, lng: 2.0, radius: 500, severity: 'medium' },
];

// Helper to calculate distance between two points in km
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c;
}

// Helper to calculate bearing
function getBearing(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const y = Math.sin(dLon) * Math.cos(lat2 * (Math.PI / 180));
  const x = Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
            Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * (180 / Math.PI);
  return (brng + 360) % 360;
}

// Generate initial shipments
let shipments: any[] = [];
let alerts: any[] = [];

function generateShipments(count: number, type: 'maritime' | 'aviation' | 'road' | 'rail', locations: any[]) {
  for (let i = 0; i < count; i++) {
    let origin, dest;
    
    if (type === 'road' || type === 'rail') {
      const route = landRoutes[Math.floor(Math.random() * landRoutes.length)];
      origin = cities.find(c => c.id === route.o);
      dest = cities.find(c => c.id === route.d);
      if (Math.random() > 0.5) {
        const temp = origin; origin = dest; dest = temp;
      }
    } else {
      origin = locations[Math.floor(Math.random() * locations.length)];
      dest = locations[Math.floor(Math.random() * locations.length)];
      while (dest.id === origin.id) {
        dest = locations[Math.floor(Math.random() * locations.length)];
      }
    }
    
    // Start somewhere along the route
    const progress = Math.random();
    const lat = origin.lat + (dest.lat - origin.lat) * progress;
    const lng = origin.lng + (dest.lng - origin.lng) * progress;
    
    let speed = 0.01;
    if (type === 'aviation') speed = 0.04 + Math.random() * 0.02;
    else if (type === 'maritime') speed = 0.005 + Math.random() * 0.005;
    else if (type === 'rail') speed = 0.01 + Math.random() * 0.005;
    else if (type === 'road') speed = 0.008 + Math.random() * 0.005;

    let prefix = 'SHP';
    if (type === 'aviation') prefix = 'FLT';
    if (type === 'road') prefix = 'TRK';
    if (type === 'rail') prefix = 'TRN';

    shipments.push({
      id: `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      type,
      lat,
      lng,
      origin: origin.name,
      dest: dest.name,
      originId: origin.id,
      destId: dest.id,
      originLat: origin.lat,
      originLng: origin.lng,
      targetLat: dest.lat,
      targetLng: dest.lng,
      status: 'on-time',
      riskScore: Math.random() * 20,
      heading: getBearing(lat, lng, dest.lat, dest.lng),
      speed,
    });
  }
}

generateShipments(8, 'maritime', ports);
generateShipments(4, 'aviation', airports);
generateShipments(6, 'road', cities);
generateShipments(6, 'rail', cities);

// --- API Routes ---

app.get('/api/phase1/bootstrap', (req, res) => {
  res.json({
    shipments,
    ports,
    airports,
    cities,
    riskZones,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/phase2/risk-model', (req, res) => {
  res.json({
    weights: { weather: 0.3, geopolitical: 0.3, congestion: 0.2, market: 0.2 },
    thresholds: { low: 25, medium: 50, high: 75, critical: 100 }
  });
});

app.get('/api/phase3/control-tower', (req, res) => {
  // Simulate movement
  shipments = shipments.map(s => {
    // Calculate distance to target
    const dist = getDistance(s.lat, s.lng, s.targetLat, s.targetLng);
    
    // If reached destination, pick a new one
    if (dist < 100) {
      let dest;
      if (s.type === 'road' || s.type === 'rail') {
        const connected = landRoutes.filter(r => r.o === s.destId || r.d === s.destId);
        if (connected.length > 0) {
          const route = connected[Math.floor(Math.random() * connected.length)];
          const nextDestId = route.o === s.destId ? route.d : route.o;
          dest = cities.find(c => c.id === nextDestId);
        } else {
          dest = cities[Math.floor(Math.random() * cities.length)]; // Fallback
        }
      } else {
        let locations = ports;
        if (s.type === 'aviation') locations = airports;
        dest = locations[Math.floor(Math.random() * locations.length)];
      }

      s.origin = s.dest;
      s.originId = s.destId;
      s.dest = dest.name;
      s.destId = dest.id;
      s.originLat = s.targetLat;
      s.originLng = s.targetLng;
      s.targetLat = dest.lat;
      s.targetLng = dest.lng;
    }

    // Update heading
    s.heading = getBearing(s.lat, s.lng, s.targetLat, s.targetLng);
    const rad = s.heading * (Math.PI / 180);
    
    // Move
    let newLat = s.lat + (Math.cos(rad) * s.speed);
    let newLng = s.lng + (Math.sin(rad) * s.speed);
    
    // Wrap longitude
    if (newLng > 180) newLng -= 360;
    if (newLng < -180) newLng += 360;

    // Check risk zones
    let inRiskZone = false;
    let highestSeverity = 'low';
    let activeZoneName = '';

    for (const zone of riskZones) {
      const d = getDistance(newLat, newLng, zone.lat, zone.lng);
      if (d < zone.radius) {
        inRiskZone = true;
        activeZoneName = zone.name;
        if (zone.severity === 'critical') highestSeverity = 'critical';
        else if (zone.severity === 'high' && highestSeverity !== 'critical') highestSeverity = 'high';
        else if (zone.severity === 'medium' && highestSeverity === 'low') highestSeverity = 'medium';
      }
    }

    // Update risk score and status
    let newRisk = s.riskScore;
    if (inRiskZone) {
      if (highestSeverity === 'critical') newRisk = Math.min(100, newRisk + 5);
      else if (highestSeverity === 'high') newRisk = Math.min(85, newRisk + 2);
      else if (highestSeverity === 'medium') newRisk = Math.min(60, newRisk + 1);
      
      // Generate alert if risk just crossed threshold
      if (newRisk > 75 && s.riskScore <= 75) {
        alerts.unshift({
          id: Date.now().toString() + Math.random(),
          type: 'critical',
          message: `Asset ${s.id} entered critical risk zone: ${activeZoneName}. Rerouting advised.`,
          timestamp: new Date().toISOString()
        });
      } else if (newRisk > 50 && s.riskScore <= 50) {
        alerts.unshift({
          id: Date.now().toString() + Math.random(),
          type: 'medium',
          message: `Asset ${s.id} experiencing delays near ${activeZoneName}.`,
          timestamp: new Date().toISOString()
        });
      }
    } else {
      newRisk = Math.max(0, newRisk - 1); // Decay risk when out of zone
    }

    let newStatus = newRisk > 75 ? 'delayed' : newRisk > 50 ? 'at-risk' : 'on-time';

    return { ...s, lat: newLat, lng: newLng, riskScore: newRisk, status: newStatus };
  });

  // Keep only last 20 alerts
  if (alerts.length > 20) alerts = alerts.slice(0, 20);

  res.json({
    shipments,
    alerts,
    timestamp: new Date().toISOString()
  });
});

// --- Vite Middleware ---
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
