// ==========================================
// SERVICE WORKER - GESTÃO DE CACHE E OFFLINE
// ==========================================

// Atualize esta versão (ex: v12, v13) sempre que alterar o código do app.js, index.html ou style.css.
// Isso força os smartphones a baixarem a versão mais recente do GitHub.
const CACHE_NAME = 'financas-v15';

// Lista de arquivos fundamentais para o sistema funcionar offline
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './render.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './firebase-config.js',
    './firebase-sync.js'
];

// Instalação: Ocorre na primeira vez que o usuário acessa ou quando a versão do CACHE_NAME muda
self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[Service Worker] Fazendo cache dos arquivos estáticos');
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting(); // Força a ativação imediata do novo Service Worker
});

// Ativação: Limpa os caches antigos (versões anteriores)
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => {
                    console.log('[Service Worker] Removendo cache antigo:', key);
                    return caches.delete(key);
                })
            );
        })
    );
    self.clients.claim(); // Assume o controle de todas as abas abertas imediatamente
});

// Fetch: Intercepta os pedidos de rede
self.addEventListener('fetch', (e) => {
    // Estratégia "Cache First, falling back to Network"
    e.respondWith(
        caches.match(e.request).then((res) => {
            // Se encontrou no cache, retorna o arquivo em cache
            if (res) return res;
            // Se não encontrou, busca na internet
            return fetch(e.request);
        })
    );
});