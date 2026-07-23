import { Capacitor } from '@capacitor/core';

export interface Coords {
  latitude: number;
  longitude: number;
  /** Metres; useful to warn when a fix is too rough to place a station by. */
  accuracy: number | null;
}

/**
 * Reads the device's current position.
 *
 * Native builds go through the Capacitor plugin so the OS permission prompt appears; the browser
 * falls back to the Web Geolocation API. Browsers only expose that API on a secure origin, so on
 * a plain http:// LAN address this fails — hence the explicit message rather than a silent no-op.
 */
export async function getCurrentPosition(): Promise<Coords> {
  if (Capacitor.isNativePlatform()) {
    const { Geolocation } = await import('@capacitor/geolocation');
    const permission = await Geolocation.checkPermissions();
    if (permission.location !== 'granted') {
      const requested = await Geolocation.requestPermissions();
      if (requested.location !== 'granted') {
        throw new Error('Ứng dụng chưa được cấp quyền truy cập vị trí. Vui lòng bật trong Cài đặt.');
      }
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy ?? null,
    };
  }

  if (!('geolocation' in navigator)) {
    throw new Error('Trình duyệt này không hỗ trợ định vị.');
  }
  if (!window.isSecureContext) {
    throw new Error('Trình duyệt chỉ cho phép lấy vị trí trên HTTPS. Hãy dùng app hoặc địa chỉ HTTPS.');
  }

  return new Promise<Coords>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy ?? null,
      }),
      err => {
        const message = err.code === err.PERMISSION_DENIED
          ? 'Bạn đã từ chối quyền truy cập vị trí.'
          : err.code === err.TIMEOUT
            ? 'Quá thời gian chờ định vị. Hãy ra chỗ thoáng và thử lại.'
            : 'Không lấy được vị trí hiện tại.';
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}
