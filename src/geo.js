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

function escapeXml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

// Ponto KML (Placemark) com a coordenada do local — abre direto no Google Earth/Maps etc.
export function buildKml(geo, name, description) {
  if (!geo) return null;
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark>
    <name>${escapeXml(name || 'Local da instalação')}</name>
    <description>${escapeXml(description || '')}</description>
    <Point>
      <coordinates>${geo.lng},${geo.lat},0</coordinates>
    </Point>
  </Placemark>
</kml>
`;
}
