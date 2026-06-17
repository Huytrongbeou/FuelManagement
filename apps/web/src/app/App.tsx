import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import { toast } from 'sonner';
import { Login } from '@/features/auth/pages/Login';
import { Sidebar } from '@/shared/components/layout/Sidebar';
import { Topbar } from '@/shared/components/layout/Topbar';
import { Dashboard } from '@/features/dashboard/pages/Dashboard';
import { StationList } from '@/features/stations/pages/StationList';
import { StationDetail } from '@/features/stations/pages/StationDetail';
import { MapView } from '@/features/stations/pages/MapView';
import { DirectEntry } from '@/features/direct-entry/pages/DirectEntry';
import { ImportExcel } from '@/features/import-export/pages/ImportExcel';
import { ImportHistory } from '@/features/import-export/pages/ImportHistory';
import { GeneratorBrands } from '@/features/generators/pages/GeneratorBrands';
import { GeneratorModels } from '@/features/generators/pages/GeneratorModels';
import { Settings } from '@/features/settings/pages/Settings';
import { StationFormModal } from '@/features/stations/components/StationFormModal';
import type { Page, Station, GeneratorBrand, GeneratorModel } from '@/shared/types';
import { getStations, getStation } from '@/features/stations/api/stationApi';
import { getBrands } from '@/features/generators/api/brandApi';
import { getModels } from '@/features/generators/api/modelApi';
import { getJobs } from '@/features/import-export/api/importApi';
import type { ImportSession } from '@/shared/types';
import { getMe } from '@/features/auth/api/authApi';
import type { AuthUser } from '@/features/auth/api/authApi';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => !!localStorage.getItem('fuel_token'));
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
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

  useEffect(() => {
    if (!isLoggedIn) return;
    getMe().then(setCurrentUser).catch(() => {
      // 401 is handled by api client (clears token + reloads)
    });
  }, [isLoggedIn]);

  const handleLogout = () => {
    localStorage.removeItem('fuel_token');
    localStorage.removeItem('fuel_user');
    setIsLoggedIn(false);
    setCurrentUser(null);
  };

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

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#f1f5f9' }}>
        <div style={{ color: '#64748b', fontSize: '1rem' }}>Đang tải...</div>
      </div>
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
    const role = currentUser?.role;
    const managerPages: Page[] = ['directEntry', 'import', 'history'];
    const adminPages: Page[] = ['brands', 'models'];
    if (role === 'staff' && (managerPages.includes(currentPage) || adminPages.includes(currentPage))) {
      return <Dashboard stations={stations} onViewStation={handleViewStation} />;
    }
    if (role === 'manager' && adminPages.includes(currentPage)) {
      return <Dashboard stations={stations} onViewStation={handleViewStation} />;
    }

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
          userRole={currentUser?.role}
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
        return <Settings userRole={currentUser?.role} stations={stations} />;
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
          userRole={currentUser.role}
          username={currentUser.username}
          onLogout={handleLogout}
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
