import { useState, useEffect, useCallback, useReducer } from 'react';
import { api } from '@/shared/api/client';
const _rawUser = localStorage.getItem('fuel:v1:user');
const _hasUser = !!_rawUser;
import { MotionConfig } from 'motion/react';
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

// Auth
type AuthState = { isLoggedIn: boolean; currentUser: AuthUser | null };
type AuthAction =
  | { type: 'login' }
  | { type: 'set-user'; user: AuthUser }
  | { type: 'logout' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'login':    return { ...state, isLoggedIn: true };
    case 'set-user': return { ...state, currentUser: action.user };
    case 'logout':   return { isLoggedIn: false, currentUser: null };
    default:         return state;
  }
}

const AUTH_INITIAL: AuthState = {
  isLoggedIn: _hasUser,
  currentUser: (() => {
    try { return _rawUser ? JSON.parse(_rawUser) : null; }
    catch { return null; }
  })(),
};

// Data
type DataState = { stations: Station[]; brands: GeneratorBrand[]; models: GeneratorModel[]; importSessions: ImportSession[]; loading: boolean };
type DataAction =
  | { type: 'loading-start' }
  | { type: 'loaded'; stations: Station[]; brands: GeneratorBrand[]; models: GeneratorModel[] }
  | { type: 'load-error' }
  | { type: 'update-stations'; stations: Station[] }
  | { type: 'update-brands'; brands: GeneratorBrand[] }
  | { type: 'update-models'; models: GeneratorModel[] }
  | { type: 'update-sessions'; sessions: ImportSession[] };

function dataReducer(state: DataState, action: DataAction): DataState {
  switch (action.type) {
    case 'loading-start':   return { ...state, loading: true };
    case 'loaded':          return { ...state, loading: false, stations: action.stations, brands: action.brands, models: action.models };
    case 'load-error':      return { ...state, loading: false };
    case 'update-stations': return { ...state, stations: action.stations };
    case 'update-brands':   return { ...state, brands: action.brands };
    case 'update-models':   return { ...state, models: action.models };
    case 'update-sessions': return { ...state, importSessions: action.sessions };
    default:                return state;
  }
}

const DATA_INITIAL: DataState = { stations: [], brands: [], models: [], importSessions: [], loading: _hasUser };

// Nav
type NavState = { currentPage: Page; selectedStation: Station | null };
type NavAction =
  | { type: 'navigate'; page: Page }
  | { type: 'view-station' }
  | { type: 'set-station'; station: Station }
  | { type: 'clear-station' };

function navReducer(state: NavState, action: NavAction): NavState {
  switch (action.type) {
    case 'navigate':      return { currentPage: action.page, selectedStation: action.page === 'stations' ? state.selectedStation : null };
    case 'view-station':  return { ...state, currentPage: 'stations' };
    case 'set-station':   return { ...state, selectedStation: action.station };
    case 'clear-station': return { ...state, selectedStation: null };
    default:              return state;
  }
}

export default function App() {
  const [auth, dispatchAuth] = useReducer(authReducer, AUTH_INITIAL);
  const [data, dispatchData] = useReducer(dataReducer, DATA_INITIAL);
  const [nav, dispatchNav] = useReducer(navReducer, { currentPage: 'dashboard' as Page, selectedStation: null });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [addStationOpen, setAddStationOpen] = useState(false);

  const { isLoggedIn, currentUser } = auth;
  const { stations, brands, models, importSessions, loading } = data;
  const { currentPage, selectedStation } = nav;

  const handleLogout = () => {
    api.post('/auth/logout').catch(() => {}); // clears HttpOnly cookie server-side (fire-and-forget)
    localStorage.removeItem('fuel:v1:user');
    dispatchAuth({ type: 'logout' });
  };

  const fetchAll = useCallback(async () => {
    dispatchData({ type: 'loading-start' });
    try {
      const [s, b, m] = await Promise.all([getStations(), getBrands(), getModels()]);
      dispatchData({ type: 'loaded', stations: s, brands: b, models: m });
    } catch (err) {
      toast.error('Lỗi tải dữ liệu: ' + (err as Error).message);
      dispatchData({ type: 'load-error' });
    }
  }, []);

  const fetchImportSessions = useCallback(async () => {
    try {
      const sessions = await getJobs();
      dispatchData({ type: 'update-sessions', sessions });
    } catch {}
  }, []);

  useEffect(() => {
    if (!_hasUser) return;
    getMe().then(user => dispatchAuth({ type: 'set-user', user })).catch(() => {});
    fetchAll();
  }, [fetchAll]);

  if (!isLoggedIn) {
    return (
      <MotionConfig reducedMotion="user">
        <>
          <Login onLogin={() => {
            dispatchAuth({ type: 'login' });
            getMe().then(user => dispatchAuth({ type: 'set-user', user })).catch(() => {});
            fetchAll();
          }} />
          <Toaster position="top-right" richColors />
        </>
      </MotionConfig>
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
    dispatchNav({ type: 'view-station' });
    const cached = stations.find(s => s.id === id);
    if (cached) dispatchNav({ type: 'set-station', station: cached });
    getStation(id).then(station => dispatchNav({ type: 'set-station', station })).catch(() => {});
  };

  const handleNavigate = (page: Page) => {
    dispatchNav({ type: 'navigate', page });
    if (page === 'history') fetchImportSessions();
  };

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
          onBack={() => dispatchNav({ type: 'clear-station' })}
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
            onUpdate={(updated) => { dispatchData({ type: 'update-brands', brands: updated }); }}
          />
        );
      case 'models':
        return (
          <GeneratorModels
            brands={brands}
            models={models}
            stations={stations}
            onUpdate={(updated) => { dispatchData({ type: 'update-models', models: updated }); }}
          />
        );
      case 'settings':
        return <Settings userRole={currentUser?.role} stations={stations} />;
      default:
        return <Dashboard stations={stations} onViewStation={handleViewStation} />;
    }
  };

  const isMapPage = currentPage === 'map';
  const isDirectEntry = currentPage === 'directEntry';
  const pageContent = renderContent();

  return (
    <MotionConfig reducedMotion="user">
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
            {pageContent}
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
    </MotionConfig>
  );
}
