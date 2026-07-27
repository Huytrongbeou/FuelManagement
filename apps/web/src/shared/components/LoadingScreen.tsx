import { LazyMotion, domAnimation, m } from 'motion/react';

interface Props {
  message?: string;
  /** Fill the viewport (cold start) vs fill the parent container (in-app data load). */
  fullScreen?: boolean;
}

/** Branded loading state: a VNPT-blue ring spinning around a gently pulsing logo. */
export function LoadingScreen({ message = 'Đang tải dữ liệu', fullScreen = false }: Props) {
  return (
    <LazyMotion features={domAnimation}>
      <div
        className={`flex items-center justify-center w-full ${fullScreen ? 'h-screen' : 'h-full'}`}
        style={{ background: '#f1f5f9' }}
      >
        <div className="flex flex-col items-center gap-5">
          <div className="relative" style={{ width: 76, height: 76 }}>
            <m.div
              className="absolute inset-0 rounded-full"
              style={{ border: '3px solid #dbeafe', borderTopColor: '#2563eb' }}
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: 'linear', duration: 0.9 }}
            />
            <m.div
              className="absolute inset-0 flex items-center justify-center"
              animate={{ scale: [1, 1.09, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
            >
              <div
                className="flex items-center justify-center overflow-hidden"
                style={{ width: 44, height: 44, borderRadius: 10, background: 'white', border: '1px solid #e2e8f0', padding: 3 }}
              >
                <img src="/vnpt-logo.jpg" alt="VNPT" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              </div>
            </m.div>
          </div>

          <div className="flex items-center" style={{ color: '#475569', fontSize: '0.9rem', fontWeight: 500 }}>
            <span>{message}</span>
            {[0, 1, 2].map(i => (
              <m.span
                key={i}
                animate={{ opacity: [0.2, 1, 0.2] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut', delay: i * 0.2 }}
                style={{ marginLeft: 1 }}
              >
                .
              </m.span>
            ))}
          </div>
        </div>
      </div>
    </LazyMotion>
  );
}
