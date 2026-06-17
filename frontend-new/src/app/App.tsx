import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Dashboard } from './components/Dashboard';
import { StationList } from './components/StationList';
import { StationDetail } from './components/StationDetail';
import { MapView } from './components/MapView';
import { DirectEntry } from './components/DirectEntry';
import { ImportExcel } from './components/ImportExcel';
import { ImportHistory } from './components/ImportHistory';
import { GeneratorBrands } from './components/GeneratorBrands';
import { GeneratorModels } from './components/GeneratorModels';
import { Settings } from './components/Settings';
import { StationFormModal } from './components/StationFormModal';
import type { Page, Station, GeneratorBrand, GeneratorModel } from './types';
import { getStations, getStation } from './api/stationApi';
import { getBrands } from './api/brandApi';
import { getModels } from './api/modelApi';
import { getJobs } from './api/importApi';
import type { ImportSession } from './types';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('fuel_token'));
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [stations, setStations] = useState<Station[]>([]);
  const [brands, setBrands] = useState<GeneratorBrand[]>([]);
  const [models, setModels] = useState<GeneratorModel[]>([]);
  const [importSessions, setImportSessions] = useState<ImportSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [addStationOpen, setAddStationOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const [s, b, m] = await Promise.all([getStations(), getBrands(), getModels()]);
      setStations(s);
      setBrands(b);
      setModels(m);
    } catch (err) {
      toast.error('Lỗi tải dữ liệu: ' + (err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  const fetchImportSessions = useCallback(async () => {
    if (!isLoggedIn) return;
    try {
      const sessions = await getJobs();
      setImportSessions(sessions);
    } catch {}
  }, [isLoggedIn]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (currentPage === 'history') fetchImportSessions();
  }, [currentPage, fetchImportSessions]);

  // Load full station detail when viewing a specific station
  useEffect(() => {
    if (!selectedStationId) { setSelectedStation(null); return; }
    const cached = stations.find(s => s.id === selectedStationId);
    if (cached) setSelectedStation(cached);
    // Fetch full detail with latest fuel state
    getStation(selectedStationId).then(setSelectedStation).catch(() => {});
  }, [selectedStationId, stations]);

  if (!isLoggedIn) {
    return (
      <>
        <Login onLogin={() => setIsLoggedIn(true)} />
        <Toaster position="top-right" richColors />
      </>
    );
  }

  const handleViewStation = (id: string) => {
    setSelectedStationId(id);
    setCurrentPage('stations');
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    if (page !== 'stations') setSelectedStationId(null);
  };

  const isMapPage = currentPage === 'map';
  const isDirectEntry = currentPage === 'directEntry';

  const renderContent = () => {
    if (loading && stations.length === 0) {
      return (
        <div className="flex items-center justify-center h-full">
          <div style={{ color: '#64748b', fontSize: '1rem' }}>Đang tải dữ liệu...</div>
        </div>
      );
    }

    if (currentPage === 'stations' && selectedStation) {
      return (
        <StationDetail
          station={selectedStation}
          records={[]}
          onBack={() => setSelectedStationId(null)}
        />
      );
    }
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard stations={stations} onViewStation={handleViewStation} />;
      case 'stations':
        return <StationList stations={stations} onViewStation={handleViewStation} onAddStation={() => setAddStationOpen(true)} />;
      case 'map':
        return <MapView stations={stations} onViewStation={handleViewStation} />;
      case 'directEntry':
        return (
          <DirectEntry
            stations={stations}
            onNavigateToDashboard={() => { fetchAll(); handleNavigate('dashboard'); }}
          />
        );
      case 'import':
        return (
          <ImportExcel
            onNavigateToHistory={() => handleNavigate('history')}
            onNavigateToDashboard={() => { fetchAll(); handleNavigate('dashboard'); }}
          />
        );
      case 'history':
        return <ImportHistory sessions={importSessions} />;
      case 'brands':
        return (
          <GeneratorBrands
            brands={brands}
            models={models}
            onUpdate={(updated) => { setBrands(updated); }}
          />
        );
      case 'models':
        return (
          <GeneratorModels
            brands={brands}
            models={models}
            stations={stations}
            onUpdate={(updated) => { setModels(updated); }}
          />
        );
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard stations={stations} onViewStation={handleViewStation} />;
    }
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden" style={{ background: '#f1f5f9' }}>
        <Sidebar
          currentPage={currentPage}
          onNavigate={handleNavigate}
          mobileOpen={mobileMenuOpen}
          onMobileClose={() => setMobileMenuOpen(false)}
        />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <Topbar
            stations={stations}
            onMobileMenuOpen={() => setMobileMenuOpen(true)}
            onNavigateToStation={handleViewStation}
          />
          <main
            className="flex-1"
            style={{
              background: '#f1f5f9',
              overflowY: (isMapPage || isDirectEntry) ? 'hidden' : 'auto',
              overflowX: 'hidden',
              display: (isMapPage || isDirectEntry) ? 'flex' : 'block',
              flexDirection: 'column',
            }}
          >
            {renderContent()}
          </main>
        </div>
      </div>
      <Toaster position="top-right" richColors />
      <StationFormModal
        open={addStationOpen}
        onClose={() => setAddStationOpen(false)}
        brands={brands}
        models={models}
        onCreated={fetchAll}
      />
    </>
  );
}
