import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, Polyline } from 'react-leaflet';
import { Activity, AlertTriangle, ShieldAlert, Ship, Plane, Clock, Globe, Terminal, Zap } from 'lucide-react';
import L from 'leaflet';
import { format } from 'date-fns';
import { GoogleGenAI } from '@google/genai';

// Custom Map Icons
const createIcon = (type: string, status: string, heading: number = 0) => {
  const color = status === 'delayed' ? '#ff3333' : status === 'at-risk' ? '#ffb000' : '#00ff66';
  let svg = '';
  // Adjust base rotation so the icon points "up" before applying heading
  let baseRotation = 0;
  
  if (type === 'aviation') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.2-1.1.6L3 8l6 5-3 3-3.5-1.5L1 16l4.5 2.5L8 23l1.5-1.5-1.5-3.5 3-3 5 6c.4-.2.7-.6.6-1.1z"/></svg>`;
    baseRotation = 45; // The airplane icon points top-right, so rotate 45 to point up
  } else if (type === 'road') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 17h4V5H2v12h3"/><path d="M20 17h2v-3.34a4 4 0 0 0-1.17-2.83L19 9h-5"/><path d="M14 17h1"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>`;
    baseRotation = 90; // The truck icon points right, so rotate 90 to point up
  } else if (type === 'rail') {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h0"/><path d="M16 15h0"/></svg>`;
    baseRotation = 0; // Train points up
  } else {
    svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76"/><path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6"/><path d="M12 10v4"/><path d="M12 2v3"/></svg>`;
    baseRotation = 0; // Ship points up
  }
  
  return L.divIcon({
    html: `<div style="filter: drop-shadow(0 0 4px ${color}); transform: rotate(${heading - baseRotation}deg); transition: transform 1s linear;">${svg}</div>`,
    className: 'custom-map-icon',
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
};

const portIcon = L.divIcon({
  html: `<div style="background-color: #00f0ff; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px #00f0ff;"></div>`,
  className: 'custom-port-icon',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

const airportIcon = L.divIcon({
  html: `<div style="background-color: #ff00ff; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px #ff00ff;"></div>`,
  className: 'custom-airport-icon',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

const cityIcon = L.divIcon({
  html: `<div style="background-color: #ffb000; width: 8px; height: 8px; border-radius: 50%; box-shadow: 0 0 8px #ffb000;"></div>`,
  className: 'custom-city-icon',
  iconSize: [8, 8],
  iconAnchor: [4, 4],
});

export default function App() {
  const [time, setTime] = useState(new Date());
  const [bootstrap, setBootstrap] = useState<any>(null);
  const [liveData, setLiveData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('data-grid');
  
  // New States
  const [filterStatus, setFilterStatus] = useState<'all' | 'at-risk' | 'delayed'>('all');
  const [panelHeight, setPanelHeight] = useState(256);
  const [isDragging, setIsDragging] = useState(false);
  
  // Chatbot States
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([
    { role: 'model', text: 'MAVEN 6.7 ONLINE. Awaiting inquiry...' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const shipments = liveData?.shipments || bootstrap?.shipments || [];
  const alerts = liveData?.alerts || [];
  const riskZones = bootstrap?.riskZones || [];
  const ports = bootstrap?.ports || [];
  const airports = bootstrap?.airports || [];
  const cities = bootstrap?.cities || [];

  const stats = {
    total: shipments.length,
    delayed: shipments.filter((s: any) => s.status === 'delayed').length,
    atRisk: shipments.filter((s: any) => s.status === 'at-risk').length,
  };

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Initial Bootstrap
  useEffect(() => {
    fetch('/api/phase1/bootstrap')
      .then(res => res.json())
      .then(data => setBootstrap(data));
  }, []);

  // Live Polling
  useEffect(() => {
    const poll = setInterval(() => {
      fetch('/api/phase3/control-tower')
        .then(res => res.json())
        .then(data => setLiveData(data));
    }, 1000);
    return () => clearInterval(poll);
  }, []);

  // Resizable Panel Logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newHeight = window.innerHeight - e.clientY;
      setPanelHeight(Math.max(100, Math.min(newHeight, window.innerHeight - 100)));
    };
    const handleMouseUp = () => setIsDragging(false);
    
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isDragging]);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const prompt = `You are MAVEN 6.7, an elite AI supply chain intelligence orchestrator.
      Current Live Data Summary:
      Total Shipments: ${stats.total}
      At Risk: ${stats.atRisk}
      Delayed: ${stats.delayed}
      Recent Alerts: ${JSON.stringify(alerts.slice(0, 3).map((a: any) => a.message))}
      
      User Question: ${userMsg}
      
      Provide a concise, analytical response based on the data. Use a highly analytical, machine-like tone.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
      });

      setChatMessages(prev => [...prev, { role: 'model', text: response.text || "No response." }]);
    } catch (e: any) {
      console.error('Gemini API Error:', e);
      setChatMessages(prev => [...prev, { role: 'model', text: `ERR_CONNECTION_FAILED: ${e.message || 'Unable to reach intelligence node.'}` }]);
    }
    setIsTyping(false);
  };

  const filteredShipments = shipments.filter((s: any) => {
    if (filterStatus === 'all') return true;
    return s.status === filterStatus;
  });

  return (
    <div className="relative h-full w-full bg-[#050505] text-[#e0e0e0] font-sans scanline overflow-hidden flex flex-col">
      
      {/* TOP BAR */}
      <header className="h-14 border-b border-[#333] bg-[#0a0a0a] flex items-center justify-between px-6 z-[1000] shrink-0">
        <div className="flex items-center gap-4">
          <Activity className="w-5 h-5 text-neon-cyan animate-pulse" />
          <h1 className="text-lg font-mono font-bold tracking-[0.3em] text-neon-cyan">MAVEN 6.7 // ORCHESTRATOR</h1>
        </div>
        <div className="flex items-center gap-8 font-mono text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">SYS_STATUS:</span>
            <span className="text-neon-green">NOMINAL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">UTC:</span>
            <span className="text-white">{format(time, 'HH:mm:ss.SSS')}</span>
          </div>
        </div>
      </header>

      <div className="flex-1 relative flex">
        
        {/* LEFT PANEL - KPIs & Alerts */}
        <aside className="w-80 border-r border-[#333] bg-[#0a0a0a]/90 backdrop-blur-md z-[1000] flex flex-col">
          <div className="p-4 border-b border-[#333]">
            <h2 className="text-xs font-mono text-gray-500 mb-3 tracking-widest flex justify-between">
              GLOBAL METRICS
              {filterStatus !== 'all' && (
                <button onClick={() => setFilterStatus('all')} className="text-neon-cyan hover:underline">CLEAR FILTER</button>
              )}
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <div 
                className={`hud-border p-3 bg-[#111] cursor-pointer transition-colors ${filterStatus === 'all' ? 'border-neon-cyan/50 bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'}`}
                onClick={() => setFilterStatus('all')}
              >
                <div className="text-[10px] text-gray-500 font-mono">ACTIVE ASSETS</div>
                <div className="text-2xl font-mono text-neon-cyan">{stats.total}</div>
              </div>
              <div 
                className={`hud-border p-3 bg-[#111] cursor-pointer transition-colors ${filterStatus === 'at-risk' ? 'border-neon-amber/50 bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'}`}
                onClick={() => setFilterStatus('at-risk')}
              >
                <div className="text-[10px] text-gray-500 font-mono">AT RISK</div>
                <div className="text-2xl font-mono text-neon-amber">{stats.atRisk}</div>
              </div>
              <div 
                className={`hud-border p-3 bg-[#111] col-span-2 cursor-pointer transition-colors ${filterStatus === 'delayed' ? 'border-neon-red/50 bg-[#1a1a1a]' : 'hover:bg-[#1a1a1a]'}`}
                onClick={() => setFilterStatus('delayed')}
              >
                <div className="text-[10px] text-gray-500 font-mono">CRITICAL DELAYS</div>
                <div className="text-2xl font-mono text-neon-red">{stats.delayed}</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <h2 className="text-xs font-mono text-gray-500 mb-3 tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-3 h-3" /> LIVE ALERTS
            </h2>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {alerts.map((alert: any) => (
                <div key={alert.id} className={`p-3 border-l-2 bg-[#111] text-xs font-mono ${
                  alert.type === 'critical' ? 'border-red-500 text-red-200' : 'border-amber-500 text-amber-200'
                }`}>
                  <div className="flex justify-between mb-1 opacity-70">
                    <span>{alert.type.toUpperCase()}</span>
                    <span>{format(new Date(alert.timestamp), 'HH:mm:ss')}</span>
                  </div>
                  <div>{alert.message}</div>
                </div>
              ))}
              {alerts.length === 0 && <div className="text-xs font-mono text-gray-600">No active alerts...</div>}
            </div>
          </div>
        </aside>

        {/* CENTER MAP */}
        <main className="flex-1 relative">
          <MapContainer center={[20, 0]} zoom={3} zoomControl={false} className="h-full w-full bg-[#0a0a0a]">
            <TileLayer
              attribution='&copy; CARTO'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
              subdomains={['a', 'b', 'c', 'd']}
              maxZoom={19}
            />
            
            {/* Risk Zones */}
            {riskZones.map((zone: any) => (
              <Circle
                key={zone.id}
                center={[zone.lat, zone.lng]}
                radius={zone.radius * 1000}
                pathOptions={{
                  color: zone.severity === 'critical' ? '#ff3333' : zone.severity === 'high' ? '#ffb000' : '#00f0ff',
                  fillColor: zone.severity === 'critical' ? '#ff3333' : zone.severity === 'high' ? '#ffb000' : '#00f0ff',
                  fillOpacity: 0.2,
                  weight: 1,
                  dashArray: '4 4'
                }}
              >
                <Popup className="font-mono text-xs">
                  <strong className="text-red-500">{zone.name}</strong><br/>
                  Severity: {zone.severity.toUpperCase()}
                </Popup>
              </Circle>
            ))}

            {/* Ports, Airports, Cities */}
            {ports.map((p: any) => (
              <Marker key={p.id} position={[p.lat, p.lng]} icon={portIcon}>
                <Popup className="font-mono text-xs bg-black text-white border border-[#333]">
                  <div className="p-1">
                    <strong className="text-neon-cyan">{p.name}</strong><br/>
                    Maritime Hub
                  </div>
                </Popup>
              </Marker>
            ))}
            {airports.map((a: any) => (
              <Marker key={a.id} position={[a.lat, a.lng]} icon={airportIcon}>
                <Popup className="font-mono text-xs bg-black text-white border border-[#333]">
                  <div className="p-1">
                    <strong className="text-[#ff00ff]">{a.name}</strong><br/>
                    Aviation Hub
                  </div>
                </Popup>
              </Marker>
            ))}
            {cities.map((c: any) => (
              <Marker key={c.id} position={[c.lat, c.lng]} icon={cityIcon}>
                <Popup className="font-mono text-xs bg-black text-white border border-[#333]">
                  <div className="p-1">
                    <strong className="text-[#ffb000]">{c.name}</strong><br/>
                    Logistics Hub
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Routes */}
            {filteredShipments.map((s: any) => {
              if (s.originLat && s.originLng && s.targetLat && s.targetLng) {
                const color = s.status === 'delayed' ? '#ff3333' : s.status === 'at-risk' ? '#ffb000' : '#00ff66';
                return (
                  <Polyline 
                    key={`route-${s.id}`} 
                    positions={[[s.originLat, s.originLng], [s.targetLat, s.targetLng]]} 
                    pathOptions={{ color, weight: 1, opacity: 0.3, dashArray: '4 4' }} 
                  />
                );
              }
              return null;
            })}

            {/* Shipments */}
            {filteredShipments.map((s: any) => (
              <Marker key={s.id} position={[s.lat, s.lng]} icon={createIcon(s.type, s.status, s.heading)}>
                <Popup className="font-mono text-xs bg-black text-white border border-[#333]">
                  <div className="p-1">
                    <strong className="text-neon-cyan">{s.id}</strong> ({s.type})<br/>
                    Route: {s.origin} &rarr; {s.dest}<br/>
                    Status: <span className={s.status === 'delayed' ? 'text-red-500' : s.status === 'at-risk' ? 'text-amber-500' : 'text-green-500'}>{s.status.toUpperCase()}</span><br/>
                    Risk Score: {s.riskScore.toFixed(1)}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </main>

        {/* RIGHT PANEL - Gemini Chatbot */}
        <aside className="w-96 border-l border-[#333] bg-[#0a0a0a]/90 backdrop-blur-md z-[1000] flex flex-col p-4">
          <h2 className="text-xs font-mono text-gray-500 mb-3 tracking-widest flex items-center gap-2">
            <Activity className="w-3 h-3" /> MAVEN 6.7 // INTEL NODE
          </h2>
          
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2 mb-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`text-xs font-mono p-3 rounded-sm ${msg.role === 'model' ? 'bg-[#111] border-l-2 border-neon-cyan text-gray-300' : 'bg-[#1a1a1a] text-white text-right'}`}>
                <div className="text-[10px] text-gray-500 mb-1">{msg.role === 'model' ? 'MAVEN 6.7' : 'OPERATOR'}</div>
                <div className="whitespace-pre-wrap">{msg.text}</div>
              </div>
            ))}
            {isTyping && (
              <div className="text-xs font-mono p-3 bg-[#111] border-l-2 border-neon-cyan text-neon-cyan animate-pulse">
                Processing query...
              </div>
            )}
          </div>

          <div className="mt-auto">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask MAVEN..."
                className="flex-1 bg-[#111] border border-[#333] text-white text-xs font-mono p-2 focus:outline-none focus:border-neon-cyan"
              />
              <button 
                onClick={handleSendMessage}
                disabled={isTyping || !chatInput.trim()}
                className="bg-[#111] border border-[#333] hover:border-neon-cyan text-neon-cyan px-3 py-2 transition-colors disabled:opacity-50"
              >
                SEND
              </button>
            </div>
          </div>
        </aside>
      </div>

      {/* BOTTOM PANEL - Analytics Tabs */}
      <footer 
        style={{ height: `${panelHeight}px` }}
        className="border-t border-[#333] bg-[#0a0a0a]/95 z-[1000] shrink-0 flex flex-col relative"
      >
        {/* Drag Handle */}
        <div 
          className="absolute top-0 left-0 right-0 h-1 bg-transparent hover:bg-neon-cyan/50 cursor-ns-resize z-10"
          onMouseDown={() => setIsDragging(true)}
        />
        
        <div className="flex border-b border-[#222]">
          {[
            { id: 'data-grid', label: 'LIVE DATA GRID' },
            { id: 'cost-analytics', label: 'COST ANALYTICS' },
            { id: 'prediction-accuracy', label: 'PREDICTION ACCURACY' },
            { id: 'disruption-intel', label: 'DISRUPTION INTELLIGENCE' },
            { id: 'carrier-performance', label: 'CARRIER PERFORMANCE' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-[10px] font-mono tracking-widest transition-colors ${
                activeTab === tab.id 
                  ? 'text-neon-cyan border-b-2 border-neon-cyan bg-[#111]' 
                  : 'text-gray-500 hover:text-gray-300 hover:bg-[#111]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {activeTab === 'data-grid' && (
            <>
              <div className="px-4 py-2 border-b border-[#222] text-[10px] font-mono text-gray-500 tracking-widest flex gap-8">
                <span className="w-24">ASSET_ID</span>
                <span className="w-24">TYPE</span>
                <span className="w-32">ORIGIN</span>
                <span className="w-32">DESTINATION</span>
                <span className="w-24">STATUS</span>
                <span className="w-24">RISK_SCORE</span>
                <span className="flex-1">COORDINATES</span>
              </div>
              {filteredShipments.map((s: any) => (
                <div key={s.id} className="flex gap-8 px-2 py-1.5 text-xs font-mono border-b border-[#111] hover:bg-[#1a1a1a] transition-colors">
                  <span className="w-24 text-neon-cyan">{s.id}</span>
                  <span className="w-24 text-gray-400">{s.type.toUpperCase()}</span>
                  <span className="w-32 text-gray-300">{s.origin}</span>
                  <span className="w-32 text-gray-300">{s.dest}</span>
                  <span className={`w-24 ${s.status === 'delayed' ? 'text-neon-red' : s.status === 'at-risk' ? 'text-neon-amber' : 'text-neon-green'}`}>
                    {s.status.toUpperCase()}
                  </span>
                  <span className="w-24 text-gray-400">{s.riskScore.toFixed(1)}</span>
                  <span className="flex-1 text-gray-500">[{s.lat.toFixed(4)}, {s.lng.toFixed(4)}]</span>
                </div>
              ))}
            </>
          )}

          {activeTab === 'cost-analytics' && (
            <div className="p-4 grid grid-cols-3 gap-6 font-mono text-xs">
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest flex items-center gap-2">
                  COST FORECAST VS ACTUAL
                  <span className="text-[10px] text-gray-600 border border-gray-600 rounded-full w-4 h-4 flex items-center justify-center cursor-help" title="Calculated based on average historical lane costs vs current real-time spot rates and active disruption penalties.">?</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Quoted (Avg)</span><span className="text-white">$60.0M</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Actual (MTD)</span><span className="text-neon-red">$62.4M</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Saved (Reroutes)</span><span className="text-neon-green">$1.5M</span></div>
                  <div className="mt-2 pt-2 border-t border-[#333] text-gray-500">Trend: <span className="text-neon-red">↑ (+4.0% vs avg)</span></div>
                </div>
              </div>
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">COST BREAKDOWN</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Base Freight</span><span className="text-white">70% ($43.6M)</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Fuel Surcharge</span><span className="text-white">14% ($8.7M)</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Expedited</span><span className="text-neon-amber">8% ($5.0M) ↑</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Insurance/Customs</span><span className="text-white">8% ($5.1M)</span></div>
                </div>
              </div>
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">TOP COST DRIVERS</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Asia→Europe (Suez)</span><span className="text-neon-red">↑ Conflict Premium</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">US West→Asia</span><span className="text-gray-500">→ Stable</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">EU→MENA</span><span className="text-neon-green">↓ Air shift to sea</span></div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'prediction-accuracy' && (
            <div className="p-4 grid grid-cols-3 gap-6 font-mono text-xs">
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest flex items-center gap-2">
                  ALERT ACCURACY (7D)
                  <span className="text-[10px] text-gray-600 border border-gray-600 rounded-full w-4 h-4 flex items-center justify-center cursor-help" title="Percentage of AI-generated alerts that resulted in actual delays or required rerouting within the last 7 days.">?</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Weather</span><span className="text-neon-green">87%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Port Closures</span><span className="text-neon-green">92%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Delay Predictions</span><span className="text-neon-amber">78%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Conflict Zones</span><span className="text-neon-cyan">100%</span></div>
                  <div className="mt-2 pt-2 border-t border-[#333] font-bold">Overall: <span className="text-neon-green">89% (↑ 3%)</span></div>
                </div>
              </div>
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">FALSE POSITIVE RATE</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Weather</span><span className="text-white">8%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">News Relevance</span><span className="text-white">12%</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Geopolitical</span><span className="text-neon-green">0%</span></div>
                  <div className="mt-2 pt-2 border-t border-[#333] font-bold">Overall FPR: <span className="text-neon-green">7% (↓ 2%)</span></div>
                </div>
              </div>
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">PREDICTION VALUE</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span className="text-gray-400">Alerts Acted Upon</span><span className="text-white">156 / 178 (88%)</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Avg Time Before Impact</span><span className="text-white">52 hours</span></div>
                  <div className="flex justify-between"><span className="text-gray-400">Successful Reroutes</span><span className="text-white">134 / 156 (86%)</span></div>
                  <div className="mt-2 pt-2 border-t border-[#333] font-bold text-neon-cyan">TOTAL VALUE: $1.8M+</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'disruption-intel' && (
            <div className="p-4 grid grid-cols-2 gap-6 font-mono text-xs">
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">ACTIVE DISRUPTIONS BY TYPE</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-neon-red mb-1">Geopolitical: 3 active zones</div>
                    <div className="text-gray-400 pl-4 border-l border-[#333]">
                      <div>Affected lanes: 18</div>
                      <div>Shipments at risk: 32 (12.9%)</div>
                      <div>Est. cost impact: $3.2M</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-neon-amber mb-1">Weather events: 7 active systems</div>
                    <div className="text-gray-400 pl-4 border-l border-[#333]">
                      <div>Typhoon season (W. Pacific): 4</div>
                      <div>Shipments at risk: 24 (9.7%)</div>
                      <div>Est. cost impact: $1.8M</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">PREDICTION TIMELINE (7 DAYS)</h3>
                <div className="space-y-2">
                  <div className="flex gap-4"><span className="text-gray-500 w-16">Day 0:</span><span className="text-neon-amber">Typhoon forms in Western Pacific</span></div>
                  <div className="flex gap-4"><span className="text-gray-500 w-16">Day 1-2:</span><span className="text-white">Vessel diversion recommended</span></div>
                  <div className="flex gap-4"><span className="text-gray-500 w-16">Day 3-4:</span><span className="text-neon-red">Peak impact (65% delay prob)</span></div>
                  <div className="flex gap-4"><span className="text-gray-500 w-16">Day 5-7:</span><span className="text-neon-green">Expected recovery</span></div>
                  <div className="mt-4 pt-4 border-t border-[#333] text-gray-400">
                    <div className="text-neon-cyan mb-1">RECOMMENDATION: EXPEDITE REROUTE</div>
                    <div>Cost of reroute: $450K | Cost of delay: $2.1M</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'carrier-performance' && (
            <div className="p-4 grid grid-cols-2 gap-6 font-mono text-xs">
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest flex items-center gap-2">
                  CARRIER PERFORMANCE
                  <span className="text-[10px] text-gray-600 border border-gray-600 rounded-full w-4 h-4 flex items-center justify-center cursor-help" title="Percentage of shipments arriving within 24 hours of the originally quoted ETA.">?</span>
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><span className="text-gray-400">Maersk</span><span>94.2% on-time <span className="text-neon-green ml-2">✓</span></span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">CMA CGM</span><span>91.5% on-time <span className="text-neon-green ml-2">✓</span></span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">COSCO</span><span>88.1% on-time <span className="text-neon-amber ml-2">⚠</span></span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">Hapag-Lloyd</span><span>92.8% on-time <span className="text-neon-green ml-2">✓</span></span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-400">ONE</span><span>86.3% on-time <span className="text-neon-red ml-2">❌</span></span></div>
                </div>
              </div>
              <div className="hud-border p-4 bg-[#111]">
                <h3 className="text-gray-500 mb-3 tracking-widest">COST PER LANE (QUOTED VS ACTUAL)</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-white"><span>Asia→Europe</span><span className="text-neon-red">+9.2%</span></div>
                    <div className="text-gray-500">$5,200/TEU quoted → $5,680 actual (Conflict premium)</div>
                  </div>
                  <div>
                    <div className="flex justify-between text-white"><span>Asia→US</span><span className="text-neon-green">-1.8%</span></div>
                    <div className="text-gray-500">$3,100/TEU quoted → $3,045 actual (Stable)</div>
                  </div>
                  <div>
                    <div className="flex justify-between text-white"><span>Europe→US</span><span className="text-neon-amber">+3.2%</span></div>
                    <div className="text-gray-500">$2,800/TEU quoted → $2,890 actual (Fuel surcharge)</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
}
