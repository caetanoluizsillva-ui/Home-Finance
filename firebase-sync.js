// ==========================================
// firebase-sync.js  —  FIRESTORE-FIRST
// Os dados vivem no Firestore.
// localStorage é apenas um cache de leitura
// rápida; NUNCA é a fonte da verdade.
// ==========================================
;(function () {

  // ── Chaves sincronizadas via Firestore ───────────────────────────────────
  // cfg_senha_exclusao DEVE ser sincronizada: a senha de exclusão precisa
  // ser a mesma em todos os aparelhos do mesmo usuário.
  const SYNC_KEYS = [
    'despesas_gastos', 'a_pagar', 'receitas', 'cartoes',
    'cat_despesas', 'cat_receitas', 'tipos_despesa', 'metas',
    'gastos_cartao', 'cfg_senha_exclusao'
  ];
  // Chaves de configuração local (NÃO sincronizadas — preferências por aparelho)
  const LOCAL_ONLY_KEYS = [
    'valoresOcultos', 'cfg_mes', 'cfg_ano'
  ];

  const COL = 'financeiro';
  const DOC = 'meus-dados';

  let _db          = null;
  let _syncAtivo   = false;
  let _escrevendo  = false;   // true enquanto onSnapshot escreve → não re-dispara push
  let _unsubscribe = null;
  let _fsCache     = null;
  let _pendingPushKeys = new Set(); // chaves aguardando push em lote
  let _pushTimer   = null;

  // ─── Referências originais do Storage ────────────────────────────────────
  const _origSet = Storage.prototype.setItem;
  const _origGet = Storage.prototype.getItem;
  const _origRem = Storage.prototype.removeItem;

  // ─── Interceptor de escrita ───────────────────────────────────────────────
  // Toda chamada localStorage.setItem feita pelo app passa por aqui.
  // Se a chave pertence a SYNC_KEYS, agenda um push em lote para o Firestore.
  Storage.prototype.setItem = function (key, value) {
    _origSet.call(this, key, value);
    if (this === localStorage &&
        _syncAtivo &&
        !_escrevendo &&
        SYNC_KEYS.includes(key)) {
      _agendarPush(key);
    }
  };

  // Intercepta removeItem para propagar remoção ao Firestore
  Storage.prototype.removeItem = function (key) {
    _origRem.call(this, key);
    if (this === localStorage &&
        _syncAtivo &&
        !_escrevendo &&
        SYNC_KEYS.includes(key)) {
      // Grava null para chaves escalares (ex: cfg_senha_exclusao) ou [] para listas
      const valorVazio = key === 'cfg_senha_exclusao' ? 'null' : JSON.stringify([]);
      _origSet.call(localStorage, key, valorVazio);
      _agendarPush(key);
    }
  };

  // ─── Push em lote (debounce 400 ms) ──────────────────────────────────────
  // Agrupa múltiplos setItem consecutivos numa única escrita ao Firestore.
  function _agendarPush(key) {
    _pendingPushKeys.add(key);
    if (_pushTimer) clearTimeout(_pushTimer);
    _pushTimer = setTimeout(_flushPush, 400);
  }

  async function _flushPush() {
    if (!_db || _pendingPushKeys.size === 0) return;
    const keys = Array.from(_pendingPushKeys);
    _pendingPushKeys.clear();
    _pushTimer = null;
    try {
      _setStatus('salvando');
      const { doc, setDoc } = await _fs();
      const payload = {};
      keys.forEach(k => {
        const raw = _origGet.call(localStorage, k);
        try {
          // cfg_senha_exclusao é uma string escalar (hash SHA-256 ou null)
          if (k === 'cfg_senha_exclusao') {
            payload[k] = (raw && raw !== 'null') ? raw : null;
          } else {
            payload[k] = raw ? JSON.parse(raw) : [];
          }
        } catch { payload[k] = []; }
      });
      await setDoc(doc(_db, COL, DOC), payload, { merge: true });
      _setStatus('ok');
    } catch (e) {
      console.error('[Sync] push erro:', e);
      _setStatus('erro');
      // Re-agenda para tentar novamente
      keys.forEach(k => _pendingPushKeys.add(k));
      _pushTimer = setTimeout(_flushPush, 5000);
    }
  }

  // ─── Importa Firestore (cached) ───────────────────────────────────────────
  async function _fs() {
    if (!_fsCache) {
      _fsCache = await import(
        'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
      );
    }
    return _fsCache;
  }

  // ─── Sobe TODOS os dados locais ao Firestore ──────────────────────────────
  // Chamado APENAS quando o documento Firestore ainda não existe (primeiro uso).
  async function _pushTudo() {
    if (!_db) return;
    try {
      _setStatus('salvando');
      const { doc, setDoc } = await _fs();
      const payload = {};
      SYNC_KEYS.forEach(k => {
        const raw = _origGet.call(localStorage, k);
        try {
          // cfg_senha_exclusao é uma string escalar (hash SHA-256 ou null)
          if (k === 'cfg_senha_exclusao') {
            payload[k] = (raw && raw !== 'null') ? raw : null;
          } else {
            payload[k] = raw ? JSON.parse(raw) : [];
          }
        } catch { payload[k] = []; }
      });
      await setDoc(doc(_db, COL, DOC), payload, { merge: true });
      console.log('[Sync] Dados locais enviados ao Firestore (primeira vez).');
      _setStatus('ok');
    } catch (e) {
      console.error('[Sync] pushTudo erro:', e);
      _setStatus('erro');
    }
  }

  // ─── Re-renderiza a aba visível ───────────────────────────────────────────
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

  // ─── onSnapshot: escuta mudanças em tempo real ───────────────────────────
  async function _listen() {
    const { doc, onSnapshot } = await _fs();
    if (_unsubscribe) _unsubscribe();

    _unsubscribe = onSnapshot(
      doc(_db, COL, DOC),
      (snap) => {
        if (!snap.exists()) {
          // Documento inexistente = primeiro acesso → envia dados locais
          _pushTudo();
          return;
        }

        const dados = snap.data();

        // ── Grava no cache local SEM disparar o interceptor (evita loop) ─
        _escrevendo = true;
        SYNC_KEYS.forEach(k => {
          if (dados[k] !== undefined) {
            // cfg_senha_exclusao é uma string escalar — não serializar com JSON.stringify
            if (k === 'cfg_senha_exclusao') {
              if (dados[k] === null || dados[k] === undefined) {
                _origRem.call(localStorage, k);
              } else {
                _origSet.call(localStorage, k, dados[k]);
              }
            } else {
              _origSet.call(localStorage, k, JSON.stringify(dados[k]));
            }
          }
        });
        _escrevendo = false;
        // Atualiza badge de senha de exclusão se a aba configurações estiver visível
        if (typeof _atualizarStatusSenhaExclusao === 'function') {
          setTimeout(_atualizarStatusSenhaExclusao, 60);
        }
        _setStatus('ok');

        // ── Sincroniza status de faturas de cartão ────────────────────────
        setTimeout(function () {
          if (typeof window._ccSincronizarStatusDeFaturas === 'function') {
            window._ccSincronizarStatusDeFaturas();
          }
        }, 80);

        _render();
        console.log('[Sync] Cache local atualizado com dados do Firestore.');
      },
      (err) => {
        console.error('[Sync] listener erro:', err);
        _setStatus('erro');
      }
    );
    console.log('[Sync] Listener Firestore ativo — modo Firestore-first.');
  }

  // ─── Indicador visual ─────────────────────────────────────────────────────
  function _setStatus(s) {
    const cores  = { ok: '#27ae60', salvando: '#f39c12', erro: '#e74c3c' };
    const labels = { ok: '☁ Sincronizado', salvando: '↑ Salvando...', erro: '✗ Erro sync' };
    const dot = document.getElementById('sync-status-dot');
    const txt = document.getElementById('sync-status-txt');
    if (dot) dot.style.color = cores[s] || '#999';
    if (txt) txt.textContent  = labels[s] || s;
  }

  // ─── API pública: forçar sincronização manual ─────────────────────────────
  // Útil para o botão "Sincronizar agora" na aba Configurações.
  window.sincronizarAgora = async function () {
    if (!_db) { toast('Sem conexão com o Firebase.', 'error'); return; }
    _setStatus('salvando');
    try {
      const { doc, getDoc } = await _fs();
      const snap = await getDoc(doc(_db, COL, DOC));
      if (snap.exists()) {
        const dados = snap.data();
        _escrevendo = true;
        SYNC_KEYS.forEach(k => {
          if (dados[k] !== undefined) {
            if (k === 'cfg_senha_exclusao') {
              if (dados[k] === null || dados[k] === undefined) {
                _origRem.call(localStorage, k);
              } else {
                _origSet.call(localStorage, k, dados[k]);
              }
            } else {
              _origSet.call(localStorage, k, JSON.stringify(dados[k]));
            }
          }
        });
        _escrevendo = false;
        _setStatus('ok');
        _render();
        if (typeof toast === 'function') toast('Dados sincronizados!', 'success');
      }
    } catch (e) {
      console.error('[Sync] sincronizarAgora erro:', e);
      _setStatus('erro');
      if (typeof toast === 'function') toast('Erro ao sincronizar.', 'error');
    }
  };

  // ─── Ponto de entrada ─────────────────────────────────────────────────────
  async function iniciarSync(firebaseApp) {
    try {
      const { getFirestore, enableIndexedDbPersistence } = await _fs();
      _db = getFirestore(firebaseApp);

      // Habilita persistência offline (IndexedDB) — dados disponíveis mesmo sem internet
      try {
        await enableIndexedDbPersistence(_db);
        console.log('[Sync] Persistência offline (IndexedDB) ativada.');
      } catch (pe) {
        if (pe.code === 'failed-precondition') {
          console.warn('[Sync] Múltiplas abas abertas — persistência offline desativada nesta aba.');
        } else if (pe.code === 'unimplemented') {
          console.warn('[Sync] Navegador não suporta persistência offline.');
        }
      }

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
