// Este Service Worker es minimalista para permitir la instalación
self.addEventListener('install', (e) => {
  console.log('Service Worker: Instalado');
});

self.addEventListener('fetch', (e) => {
  //por ahora solo dejamos que pase la petición
  e.respondWith(fetch(e.request));
});