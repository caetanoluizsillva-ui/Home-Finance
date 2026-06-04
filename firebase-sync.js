// ==========================================
// firebase-sync.js
// DEVE SER O PRIMEIRO SCRIPT NO index.html
// ==========================================
;(function () {

  const SYNC_KEYS = [
    'despesas_gastos', 'a_pagar', 'receitas', 'cartoes',
    'cat_despesas', 'cat_receitas', 'tipos_despesa', 'metas',
    'gastos_cartao'
  ];
  const COL = 'financeiro';
  const DOC = 'meus-dados';

  let _db          = null;
  let _syncAtivo   = false;
  let _escrevendo  = false;   // true enquanto onSnapshot grava → não re-sobe ao Firestore
  let _unsubscribe = null;
  let _fsCache     = null;    // módulo Firestore importado (cached)

  // ─── Referências ao setItem/getItem originais ──────────────────────────────
  // Capturadas AGORA, antes de qualquer outro script rodar.
  const _origSet = Storage.prototype.setItem;
  const _origGet = Storage.prototype.getItem;

  // ─── Interceptor instalado imediatamente ──────────────────────────────────
  // Toda chamada localStorage.setItem em app.js / render.js passa por aqui.
  Storage.prototype.setItem = function (key, value) {
    _origSet.call(this, key, value);                   // grava local normalmente
    if (this === localStorage &&
        _syncAtivo &&
        !_escrevendo &&
        SYNC_KEYS.includes(key)) {
      _push(key, value);                               // sobe ao Firestore
    }
  };

  // ─── Importa módulo Firestore (uma vez, reutiliza cache) ─────────────────
  async function _fs() {
    if (!_fsCache) {
      _fsCache = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
    }
    return _fsCache;
  }

  // ─── Sobe UMA chave ao Firestore ─────────────────────────────────────────
  async function _push(key, rawValue) {
    if (!_db) return;
    try {
      _setStatus('salvando');
      const { doc, setDoc } = await _fs();
      let val;
      try { val = JSON.parse(rawValue); } catch { val = rawValue; }
      await setDoc(doc(_db, COL, DOC), { [key]: val }, { merge: true });
      _setStatus('ok');
    } catch (e) {
      console.error('[Sync] push erro:', key, e);
      _setStatus('erro');
    }
  }

  // ─── Sobe TODO o localStorage ao Firestore ───────────────────────────────
  // Chamado apenas quando o documento Firestore não existe ainda.
  async function _pushTudo() {
    if (!_db) return;
    try {
      _setStatus('salvando');
      const { doc, setDoc } = await _fs();
      const payload = {};
      SYNC_KEYS.forEach(k => {
        const raw = _origGet.call(localStorage, k);
        try { payload[k] = raw ? JSON.parse(raw) : []; } catch { payload[k] = []; }
      });
      await setDoc(doc(_db, COL, DOC), payload, { merge: true });
      console.log('[Sync] Dados locais enviados ao Firestore (primeira vez).');
      _setStatus('ok');
    } catch (e) {
      console.error('[Sync] pushTudo erro:', e);
      _setStatus('erro');
    }
  }

  // ─── Re-renderiza a aba visível após receber dados do Firestore ──────────
  function _render() {
    setTimeout(() => {
      try {
        const mapa = {
          'content-analise':  'renderizarAnalise',
          'content-despesas': 'renderizarDespesas',
          'content-a-pagar':  'renderizarAPagar',
          'content-receita':  'renderizarReceitas',
          'content-cartoes':  'renderizarCartoes',
          'content-dados':    'renderizarDados',
        };
        for (const [id, fn] of Object.entries(mapa)) {
          const el = document.getElementById(id);
          if (el && !el.classList.contains('hidden') && typeof window[fn] === 'function') {
            window[fn]();
            break;
          }
        }
        if (typeof atualizarIconeNotificacao === 'function') atualizarIconeNotificacao();
      } catch (e) { console.warn('[Sync] render err:', e); }
    }, 50);
  }

  // ─── Listener em tempo real ───────────────────────────────────────────────
  async function _listen() {
    const { doc, onSnapshot } = await _fs();
    if (_unsubscribe) _unsubscribe();

    _unsubscribe = onSnapshot(
      doc(_db, COL, DOC),
      (snap) => {
        if (!snap.exists()) {
          // Documento vazio = primeira vez → envia dados locais
          _pushTudo();
          return;
        }
        const dados = snap.data();
        // Grava no localStorage sem disparar o interceptor (evita loop)
        _escrevendo = true;
        SYNC_KEYS.forEach(k => {
          if (dados[k] !== undefined) {
            _origSet.call(localStorage, k, JSON.stringify(dados[k]));
          }
        });
        _escrevendo = false;
        _setStatus('ok');
        _render();
        console.log('[Sync] localStorage atualizado com dados do Firestore.');
      },
      (err) => {
        console.error('[Sync] listener erro:', err);
        _setStatus('erro');
      }
    );
    console.log('[Sync] Listener Firestore ativo.');
  }

  // ─── Indicador visual (elementos opcionais no HTML) ───────────────────────
  function _setStatus(s) {
    const cores  = { ok: '#27ae60', salvando: '#f39c12', erro: '#e74c3c' };
    const labels = { ok: '☁ Sincronizado', salvando: '↑ Salvando...', erro: '✗ Erro' };
    const dot = document.getElementById('sync-status-dot');
    const txt = document.getElementById('sync-status-txt');
    if (dot) dot.style.color = cores[s] || '#999';
    if (txt) txt.textContent  = labels[s] || s;
  }

  // ─── Ponto de entrada — chamado pelo firebase-config.js após login ────────
  async function iniciarSync(firebaseApp) {
    try {
      const { getFirestore } = await _fs();
      _db        = getFirestore(firebaseApp);
      _syncAtivo = true;
      _setStatus('salvando');
      await _listen();
    } catch (e) {
      console.error('[Sync] iniciarSync erro:', e);
      _setStatus('erro');
    }
  }

  window.iniciarSync = iniciarSync;

})();
