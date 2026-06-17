import { LayoutDashboard, MapPin, Map, Upload, History, Settings, Zap, ChevronRight, Cpu, Factory, X, ClipboardList } from 'lucide-react';
import { Page } from '../types';

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  collapsed?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navGroups = [
  {
    label: 'Vận hành',
    items: [
      { page: 'dashboard'  as Page, label: 'Dashboard',              icon: LayoutDashboard },
      { page: 'stations'   as Page, label: 'Danh sách trạm',         icon: MapPin },
      { page: 'map'        as Page, label: 'Bản đồ trạm',            icon: Map },
    ],
  },
  {
    label: 'Nhập liệu',
    items: [
      { page: 'directEntry' as Page, label: 'Nhập dữ liệu trực tiếp', icon: ClipboardList },
      { page: 'import'      as Page, label: 'Import Excel',            icon: Upload },
      { page: 'history'     as Page, label: 'Lịch sử import',         icon: History },
    ],
  },
  {
    label: 'Danh mục',
    items: [
      { page: 'brands'   as Page, label: 'Hãng máy phát',  icon: Factory },
      { page: 'models'   as Page, label: 'Model máy phát', icon: Cpu },
    ],
  },
  {
    label: 'Hệ thống',
    items: [
      { page: 'settings' as Page, label: 'Tài khoản / Cài đặt', icon: Settings },
    ],
  },
];

export function Sidebar({ currentPage, onNavigate, collapsed, mobileOpen, onMobileClose }: SidebarProps) {
  const handleNav = (page: Page) => { onNavigate(page); onMobileClose?.(); };

  const sidebarContent = (
    <div className="flex flex-col h-full" style={{ background: '#0c2340' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="flex items-center justify-center w-9 h-9 rounded-lg flex-shrink-0" style={{ background: '#2563eb' }}>
          <Zap size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem', lineHeight: 1.2 }}>VNPT</div>
            <div style={{ color: '#7dd3fc', fontSize: '0.7rem' }}>Hệ thống quản lý NL</div>
          </div>
        )}
        {mobileOpen && (
          <button onClick={onMobileClose} className="ml-auto" style={{ color: '#94a3b8' }}><X size={20} /></button>
        )}
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-3 space-y-4 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            {!collapsed && (
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#4b6cb7', textTransform: 'uppercase', letterSpacing: '0.1em', paddingLeft: '12px', marginBottom: '4px' }}>
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ page, label, icon: Icon }) => {
                const active = currentPage === page;
                return (
                  <button
                    key={page}
                    onClick={() => handleNav(page)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group relative"
                    style={{
                      background: active ? 'rgba(37,99,235,0.25)' : 'transparent',
                      color: active ? '#93c5fd' : '#94a3b8',
                    }}
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {active && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full" style={{ background: '#2563eb' }} />}
                    <Icon size={17} />
                    {!collapsed && (
                      <>
                        <span style={{ fontSize: '0.84rem', fontWeight: active ? 600 : 400, flex: 1, textAlign: 'left' }}>{label}</span>
                        {active && <ChevronRight size={13} style={{ color: '#2563eb' }} />}
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User */}
      {!collapsed && (
        <div className="px-3 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#2563eb', color: 'white', fontSize: '0.85rem', fontWeight: 700 }}>A</div>
            <div className="flex-1 min-w-0">
              <div style={{ color: 'white', fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Nguyễn Văn A</div>
              <div style={{ color: '#7dd3fc', fontSize: '0.7rem' }}>Quản trị viên</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="hidden lg:flex flex-col flex-shrink-0 h-full transition-all duration-300" style={{ width: collapsed ? '64px' : '240px' }}>
        {sidebarContent}
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onMobileClose} />
          <div className="relative flex flex-col w-64 h-full z-10">{sidebarContent}</div>
        </div>
      )}
    </>
  );
}
