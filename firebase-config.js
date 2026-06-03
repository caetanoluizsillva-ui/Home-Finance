// ==========================================
// firebase-config.js
// ==========================================
const firebaseConfig = {
  apiKey           : "AIzaSyApdn5OqDXkckc4vzsY2fFfgZT0AWw139s",
  authDomain       : "finan-lhsc.firebaseapp.com",
  projectId        : "finan-lhsc",
  storageBucket    : "finan-lhsc.firebasestorage.app",
  messagingSenderId: "7930639364",
  appId            : "1:7930639364:web:7a2e6865a4a78db5bcb151"
};

window.FIREBASE_CONFIG  = firebaseConfig;
window.FIREBASE_ENABLED = true;

(async function initFirebase() {
  try {
    // Importa App + Auth em paralelo (economiza ~600ms vs. await sequencial)
    const [
      { initializeApp },
      { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, sendPasswordResetEmail }
    ] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
    ]);

    const app  = initializeApp(firebaseConfig);
    const auth = getAuth(app);

    // Expõe para app.js e firebase-sync.js
    window._firebaseApp  = app;
    window._firebaseAuth = auth;
    window._firebaseAPI  = { signInWithEmailAndPassword, signOut, sendPasswordResetEmail };

    // Dispara evento: app.js aguarda isso para liberar o botão de login
    window._firebaseReady = true;
    window.dispatchEvent(new Event('firebaseReady'));

    // Status visual
    const dot = document.getElementById('firebase-status-dot');
    const txt = document.getElementById('firebase-status-txt');
    if (dot) dot.style.color = '#27ae60';
    if (txt) txt.textContent = 'Conectado ao Firebase';

    console.log('[Firebase] Pronto.');

    // Monitora sessão
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Usuário logado → mostra app e inicia sync
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        if (typeof iniciarSync === 'function') await iniciarSync(app);
      } else {
        // Deslogado → mostra tela de login
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('login-screen').classList.remove('hidden');
      }
    });

  } catch (err) {
    console.error('[Firebase] Erro na inicialização:', err);
    const dot = document.getElementById('firebase-status-dot');
    const txt = document.getElementById('firebase-status-txt');
    if (dot) dot.style.color = '#e74c3c';
    if (txt) txt.textContent = 'Erro de conexão';
  }
})();
