export function captureGeolocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocalização não suportada neste dispositivo.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: Date.now()
        });
      },
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function mapsLink(geo) {
  if (!geo) return '';
  // Formato oficial da Maps URLs API: garante um marcador/pino na coordenada.
  return `https://www.google.com/maps/search/?api=1&query=${geo.lat},${geo.lng}`;
}
