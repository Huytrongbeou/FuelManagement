import { useState } from 'react';
import { Zap, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { login } from '../api/authApi';

interface LoginProps {
  onLogin: () => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Vui lòng nhập đầy đủ thông tin.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await login(username, password);
      localStorage.setItem('fuel_token', result.token);
      localStorage.setItem('fuel_user', JSON.stringify(result.user));
      setLoading(false);
      onLogin();
    } catch (err) {
      setLoading(false);
      setError((err as Error).message || 'Đăng nhập thất bại');
    }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'linear-gradient(135deg, #0c2340 0%, #1a4a7a 50%, #0e3560 100%)' }}>
      {/* Left panel - Illustration */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white/30"
              style={{
                width: `${(i + 1) * 60}px`,
                height: `${(i + 1) * 60}px`,
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
              }}
            />
          ))}
        </div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative z-10 text-center"
        >
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl mb-8 mx-auto" style={{ background: 'rgba(255,255,255,0.15)' }}>
            <Zap size={40} className="text-white" />
          </div>
          <h1 className="text-white mb-4" style={{ fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 }}>
            Quản lý nhiên liệu<br />máy phát điện
          </h1>
          <p className="text-blue-200 max-w-sm mx-auto" style={{ fontSize: '1rem', lineHeight: 1.6 }}>
            Hệ thống theo dõi và quản lý nhiên liệu tại các trạm máy phát điện trên toàn quốc.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            {[
              { value: '30+', label: 'Trạm' },
              { value: '99%', label: 'Uptime' },
              { value: 'Real-time', label: 'Dữ liệu' },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <div className="text-white mb-1" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stat.value}</div>
                <div className="text-blue-200" style={{ fontSize: '0.875rem' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Right panel - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: '#0c2340' }}>
              <Zap size={20} className="text-white" />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0c2340' }}>VNPT</span>
          </div>

          <h2 className="mb-2" style={{ color: '#0c2340' }}>Đăng nhập hệ thống</h2>
          <p className="mb-8" style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Nhập thông tin tài khoản của bạn để tiếp tục.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block mb-2" style={{ color: '#374151', fontSize: '0.875rem' }}>
                Tên đăng nhập
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Nhập tên đăng nhập"
                className="w-full px-4 py-3 rounded-lg border outline-none transition-all"
                style={{
                  borderColor: error && !username ? '#ef4444' : '#e2e8f0',
                  background: '#f8fafc',
                  color: '#1e293b',
                  fontSize: '0.9rem',
                }}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label className="block mb-2" style={{ color: '#374151', fontSize: '0.875rem' }}>
                Mật khẩu
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Nhập mật khẩu"
                  className="w-full px-4 py-3 pr-12 rounded-lg border outline-none transition-all"
                  style={{
                    borderColor: '#e2e8f0',
                    background: '#f8fafc',
                    color: '#1e293b',
                    fontSize: '0.9rem',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: '#94a3b8' }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="rounded-lg px-4 py-3" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{
                background: loading ? '#93c5fd' : '#2563eb',
                color: 'white',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Đang đăng nhập...
                </>
              ) : 'Đăng nhập'}
            </button>
          </form>

          <p className="text-center mt-6" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
            Tài khoản: admin / admin123
          </p>

          <div className="mt-8 pt-6 border-t" style={{ borderColor: '#f1f5f9' }}>
            <p style={{ color: '#94a3b8', fontSize: '0.8rem', textAlign: 'center' }}>
              © 2026 VNPT — Hệ thống Quản lý Nhiên liệu Trạm
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
