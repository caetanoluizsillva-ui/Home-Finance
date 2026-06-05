// ==========================================
// TELA DE LOGIN: Mostrar/Ocultar Senha
// ==========================================
function toggleSenhaVisivel() {
    const inputSenha = document.getElementById('password');
    const iconOlho = document.getElementById('olho-icon'); 
    
    if (inputSenha && inputSenha.type === 'password') {
        inputSenha.type = 'text';
        if (iconOlho) iconOlho.className = 'fas fa-eye-slash';
    } else if (inputSenha) {
        inputSenha.type = 'password';
        if (iconOlho) iconOlho.className = 'fas fa-eye';
    }
}

// ==========================================
// LOGIN / LOGOUT / NAVEGAÇÃO
// ==========================================
async function fazerLogin() {
    const email = document.getElementById('username').value.trim(); 
    const pass  = document.getElementById('password').value;
    const err   = document.getElementById('login-error');
    const btn   = document.getElementById('btn-login');

    if (!email || !pass) {
        if(err) err.innerText = 'Preencha o e-mail e a senha.';
        return;
    }

    // Aguarda Firebase ficar pronto (comum em conexões lentas)
    if (!window._firebaseReady) {
        if(err) { err.style.color='#2980b9'; err.innerText='Conectando...'; }
        if(btn) { btn.disabled=true; btn.innerText='Aguarde...'; }
        await new Promise(resolve => {
            if (window._firebaseReady) return resolve();
            window.addEventListener('firebaseReady', resolve, { once: true });
            setTimeout(resolve, 8000);
        });
        if(btn) { btn.disabled=false; btn.innerText='Entrar no Sistema'; }
        if (!window._firebaseAPI) {
            if(err) { err.style.color='#c0392b'; err.innerText='Sem conexão com o servidor.'; }
            return;
        }
        if(err) err.innerText='';
    }

    try {
        if(err) { err.style.color = '#2980b9'; err.innerText = 'Autenticando...'; }
        if(btn) { btn.disabled = true; btn.innerText = 'Aguarde...'; }

        const { signInWithEmailAndPassword } = window._firebaseAPI;
        await signInWithEmailAndPassword(window._firebaseAuth, email, pass);
        
        if(err) err.innerText = '';
        if(btn) { btn.disabled = false; btn.innerText = 'Entrar no Sistema'; }
    } catch (error) {
        console.error("Erro no login:", error);
        if(err) {
            err.style.color = '#c0392b';
            const msgs = {
                'auth/user-not-found': 'E-mail não cadastrado.',
                'auth/wrong-password': 'Senha incorreta.',
                'auth/invalid-email': 'Formato de e-mail inválido.',
                'auth/invalid-credential': 'As credenciais estão incorretas.'
            };
            err.innerText = msgs[error.code] || 'Erro ao fazer login. Verifique seus dados.';
        }
        if(btn) { btn.disabled = false; btn.innerText = 'Entrar no Sistema'; }
    }
}

// Evento de Enter na Senha
const passInput = document.getElementById('password');
if(passInput) {
    passInput.addEventListener('keypress', e => { 
        if (e.key === 'Enter') fazerLogin(); 
    });
}

async function fazerLogout() {
    if (window._firebaseAPI && window._firebaseAuth) {
        const { signOut } = window._firebaseAPI;
        await signOut(window._firebaseAuth); 
    }
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
}

function mudarAba(nome, id, el) {
    const icon = el.querySelector('.menu-icon').innerText;
    document.getElementById('page-title').innerHTML = `<span class="title-icon">${icon}</span><span class="title-text">${nome}</span>`;
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    // Se o item é oculto, mantém "Dados" como ativo visualmente no sidebar
    if (el.classList.contains('menu-item--hidden')) {
        const dadosItem = document.querySelector('.menu-item[data-tab="dados"]');
        if (dadosItem) dadosItem.classList.add('active');
    } else {
        el.classList.add('active');
    }
    // Propaga cor do menu ativo para bordas dos campos nos modais
    const cor = el.dataset.color || '#3498db';
    document.documentElement.style.setProperty('--modal-accent', cor);
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('content-' + id).classList.remove('hidden');
    const renders = {
        analise: renderizarAnalise, despesas: renderizarDespesas, 'a-pagar': renderizarAPagar,
        receita: renderizarReceitas, cartoes: renderizarCartoes, dados: renderizarDados, previsao: renderizarPrevisao, configuracoes: renderizarConfiguracoes
    };
    if (renders[id]) renders[id]();
    setTimeout(atualizarIconeNotificacao, 200);
}

function voltarParaAnalise() {
    mudarAba('Análise','analise', document.querySelector('.menu-item[onclick*="analise"]') || document.querySelector('.menu-item'));
    if (typeof renderizarAnalise === 'function') renderizarAnalise();
}

// ==========================================
// STORAGE E VARIÁVVEIS GLOBAIS
// ==========================================
function getData(key, def=[]) {
    try { const v=localStorage.getItem(key); return v?JSON.parse(v):def; } catch { return def; }
}

function uid() { return Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function brl(n) { return 'R$ '+(+n||0).toLocaleString('pt-BR',{minimumFractionDigits:2}); }

const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
const MESES_FULL  = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

// O mês atual em JavaScript vai de 0 (Janeiro) a 11 (Dezembro)
let _mesSel = new Date().getMonth(); 
let _anoSel = new Date().getFullYear();

function getMesSel()  { return _mesSel; }
function getAnoSel()  { return _anoSel; }

function _atualizarHeaderMes() {
    const label = document.getElementById('header-mes-label');
    if (!label) return;
    if (_mesSel === null) label.textContent = 'Todos';
    else label.textContent = MESES_ABREV[_mesSel] + ' ' + String(_anoSel).slice(2);
}

function navegarMes(dir) {
    if (_mesSel === null) {
        const hoje = new Date();
        _mesSel = hoje.getMonth(); _anoSel = hoje.getFullYear();
    }
    _mesSel += dir;
    if (_mesSel < 0)  { _mesSel = 11; _anoSel--; }
    if (_mesSel > 11) { _mesSel = 0;  _anoSel++; }
    _atualizarHeaderMes();
    localStorage.setItem('cfg_mes', JSON.stringify(_mesSel));
    localStorage.setItem('cfg_ano', JSON.stringify(_anoSel));
    _sincronizarAnoConfig();
    if (typeof renderizarDespesas === 'function') renderizarDespesas(); 
    if (typeof renderizarAPagar === 'function') renderizarAPagar(); 
    if (typeof renderizarReceitas === 'function') renderizarReceitas(); 
    if (typeof renderizarAnalise === 'function') renderizarAnalise();
}
// ==========================================
// MODO PRIVACIDADE
// ==========================================
function toggleOcultarValores() {
    const body = document.body;
    const icon = document.getElementById('icon-ocultar');
    
    // Liga ou desliga a classe 'modo-oculto' no body
    body.classList.toggle('modo-oculto');
    
    if (body.classList.contains('modo-oculto')) {
        // Mudamos o ícone para o olho cortado e guardamos a preferência
        if(icon) icon.className = 'fas fa-eye-slash';
        localStorage.setItem('valoresOcultos', 'true');
        toast('Modo privacidade ativado', 'success');
    } else {
        // Voltamos ao olho normal
        if(icon) icon.className = 'fas fa-eye';
        localStorage.setItem('valoresOcultos', 'false');
        toast('Valores visíveis', 'success');
    }
}

// Verifica se o utilizador já tinha deixado o modo oculto ativado na última visita// ==========================================
// GATILHO DE ARRANQUE DO SISTEMA
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
    // 0. Aplicar cores CSS vars nos itens do menu lateral
    document.querySelectorAll('.menu-item[data-color]').forEach(item => {
        const c = item.dataset.color;
        item.style.setProperty('--item-color', c);
        item.style.setProperty('--item-bg', c + '1a'); // hex 1a ≈ 10% opacity
    });
    // Cor inicial do accent (aba Análise = azul)
    const activeItem = document.querySelector('.menu-item.active[data-color]');
    if (activeItem) document.documentElement.style.setProperty('--modal-accent', activeItem.dataset.color);

    // 1. Lembrar a preferência do Modo Privacidade
    if (localStorage.getItem('valoresOcultos') === 'true') {
        document.body.classList.add('modo-oculto');
        const icon = document.getElementById('icon-ocultar');
        if (icon) icon.className = 'fas fa-eye-slash';
    }

    // 2. Forçar a barra de topo a mostrar o Mês e Ano atuais
    _mesSel = new Date().getMonth();
    _anoSel = new Date().getFullYear();
    
    // Chama as funções que atualizam os textos na tela
    if (typeof _atualizarHeaderMes === 'function') _atualizarHeaderMes();
    if (typeof _sincronizarAnoConfig === 'function') _sincronizarAnoConfig();
    if (typeof _atualizarDataHoje === 'function') _atualizarDataHoje();
    
    // Se a aplicação já estiver pronta, força a renderização para mostrar os dados de hoje
    setTimeout(() => {
        if (typeof renderizarAnalise === 'function' && !document.getElementById('content-analise').classList.contains('hidden')) {
            renderizarAnalise();
        }
    }, 100);
});

// ==========================================
// GUARD DE EXCLUSÃO — CONFIRMAÇÃO POR SENHA
// ==========================================
// Funções protegidas: despesas, a_pagar, cartões, gastos_cartao, categorias, tipos, metas
// Excluídas da proteção: receitas, configurações, previsão

;(function _instalarGuardExclusao() {

    let _pendingCallback = null;
    let _isMesAnterior   = false;

    // ── Detecta se uma data/item pertence a mês anterior ao selecionado ──────
    function _ehMesAnterior(dataISO) {
        if (!dataISO) return false;
        const d = new Date(dataISO + 'T00:00:00');
        const hoje = new Date();
        const mesAtual = hoje.getMonth();
        const anoAtual = hoje.getFullYear();
        // É mês anterior se for estritamente antes do mês atual real (não do selecionado)
        if (d.getFullYear() < anoAtual) return true;
        if (d.getFullYear() === anoAtual && d.getMonth() < mesAtual) return true;
        return false;
    }

    // ── Abre o modal pedindo senha, executa callback após validação ───────────
    window.confirmarExclusaoComSenha = function(callback, dataISO, avisoExtra) {
        _pendingCallback = callback;
        _isMesAnterior   = _ehMesAnterior(dataISO);

        // Reseta UI
        const inp = document.getElementById('excl-senha-input');
        const err = document.getElementById('excl-senha-erro');
        const avsEl = document.getElementById('excl-mes-anterior-aviso');
        const avisoMsg = document.getElementById('excl-aviso-msg');
        if (inp) { inp.value = ''; inp.type = 'password'; }
        if (err) { err.textContent = ''; err.style.display = 'none'; }
        const olho = document.getElementById('excl-olho-icon');
        if (olho) olho.className = 'fas fa-eye';

        // Aviso mês anterior
        if (avsEl) avsEl.classList.toggle('hidden', !_isMesAnterior);
        // Mensagem customizada
        if (avisoMsg && avisoExtra) avisoMsg.textContent = avisoExtra;
        else if (avisoMsg) avisoMsg.textContent = 'A exclusão de dados pode gerar inconsistências no sistema, especialmente em registros com vínculos (faturas, parcelas, relatórios).';

        document.getElementById('modal-confirmar-exclusao').classList.remove('hidden');
        setTimeout(() => { if (inp) inp.focus(); }, 100);
    };

    // ── Toggler do olho ───────────────────────────────────────────────────────
    window._exclToggleSenha = function() {
        const inp = document.getElementById('excl-senha-input');
        const ic  = document.getElementById('excl-olho-icon');
        if (!inp) return;
        if (inp.type === 'password') { inp.type = 'text'; if(ic) ic.className = 'fas fa-eye-slash'; }
        else                         { inp.type = 'password'; if(ic) ic.className = 'fas fa-eye'; }
    };

    // ── Confirmar: valida senha (customizada ou Firebase) ─────────────────────
    window._exclConfirmar = async function() {
        const inp = document.getElementById('excl-senha-input');
        const err = document.getElementById('excl-senha-erro');
        const btn = document.getElementById('excl-btn-confirmar');
        const senha = inp ? inp.value : '';

        if (!senha) {
            if (err) { err.textContent = 'Digite sua senha para confirmar.'; err.style.display = 'block'; }
            return;
        }

        // Bloqueia botão enquanto valida
        if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...'; }

        try {
            // 1º — verifica se há senha de exclusão personalizada salva
            const senhaCustom = localStorage.getItem('cfg_senha_exclusao');

            if (senhaCustom) {
                // Valida contra a senha customizada (hash simples)
                const hashDigitado = await _hashSenha(senha);
                if (hashDigitado !== senhaCustom) {
                    throw { message: 'Senha de exclusão incorreta. Tente novamente.' };
                }
            } else {
                // Fallback: usa autenticação Firebase (senha de acesso)
                const auth = window._firebaseAuth;
                const api  = window._firebaseAPI;

                if (auth && auth.currentUser && api) {
                    const { EmailAuthProvider, reauthenticateWithCredential } = await import(
                        'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
                    );
                    const cred = EmailAuthProvider.credential(auth.currentUser.email, senha);
                    await reauthenticateWithCredential(auth.currentUser, cred);
                } else {
                    // Fallback offline: compara com a senha guardada em sessão
                    if (!window._sessaoSenha || senha !== window._sessaoSenha) {
                        throw new Error('Senha incorreta.');
                    }
                }
            }

            // Senha correta → executa a exclusão pendente
            fecharModal('modal-confirmar-exclusao');
            if (typeof _pendingCallback === 'function') _pendingCallback();
            _pendingCallback = null;

        } catch (e) {
            const msgs = {
                'auth/wrong-password':       'Senha incorreta. Tente novamente.',
                'auth/invalid-credential':   'Senha incorreta. Tente novamente.',
                'auth/too-many-requests':    'Muitas tentativas. Aguarde alguns minutos.',
            };
            const msg = msgs[e.code] || e.message || 'Senha incorreta. Tente novamente.';
            if (err) { err.textContent = msg; err.style.display = 'block'; }
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-trash"></i> Excluir'; }
        }
    };

    // ── Enter no campo de senha ───────────────────────────────────────────────
    document.addEventListener('keydown', function(e) {
        const modal = document.getElementById('modal-confirmar-exclusao');
        if (!modal || modal.classList.contains('hidden')) return;
        if (e.key === 'Enter') { e.preventDefault(); window._exclConfirmar(); }
        if (e.key === 'Escape') { fecharModal('modal-confirmar-exclusao'); }
    });

    // ── Captura a senha no login para fallback offline ────────────────────────
    // Sobrepõe fazerLogin para armazenar a senha na sessão após login bem-sucedido
    const _origFazerLogin = window.fazerLogin;
    window.fazerLogin = async function() {
        const pass = document.getElementById('password');
        const senhaDigitada = pass ? pass.value : '';
        await _origFazerLogin();
        // Se logou com sucesso, armazena em memória (não em localStorage)
        if (window._firebaseAuth && window._firebaseAuth.currentUser) {
            window._sessaoSenha = senhaDigitada;
        }
        // Monitora mudanças de auth para limpar quando deslogar
    };

    // Monitora o auth state change para limpar sessaoSenha no logout
    window.addEventListener('firebaseReady', () => {
        setTimeout(() => {
            const auth = window._firebaseAuth;
            if (auth) {
                import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
                    .then(({ onAuthStateChanged }) => {
                        onAuthStateChanged(auth, user => {
                            if (!user) window._sessaoSenha = null;
                        });
                    });
            }
        }, 500);
    });

    // ── Helper global para checar se data é de mês anterior ──────────────────
    window._guardEhMesAnterior = _ehMesAnterior;

})();

// ==========================================
// SENHA DE EXCLUSÃO PERSONALIZADA
// ==========================================
// Hash simples via Web Crypto API (SHA-256) — não requer backend
async function _hashSenha(senha) {
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode('excl_lhsc_' + senha));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function abrirModalDefinirSenhaExclusao() {
    // Preenche o e-mail com o do usuário logado (se disponível)
    const loginInput = document.getElementById('dse-login');
    if (loginInput && window._firebaseAuth && window._firebaseAuth.currentUser) {
        loginInput.value = window._firebaseAuth.currentUser.email || '';
    } else if (loginInput) {
        loginInput.value = '';
    }
    // Limpa campos
    ['dse-senha-acesso','dse-nova-senha','dse-confirmar-senha'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.value = ''; el.type = 'password'; }
    });
    ['dse-olho1','dse-olho2','dse-olho3'].forEach(id => {
        const ic = document.getElementById(id);
        if (ic) ic.className = 'fas fa-eye';
    });
    const err = document.getElementById('dse-erro');
    if (err) { err.textContent = ''; err.style.display = 'none'; }
    document.getElementById('modal-definir-senha-excl').classList.remove('hidden');
    setTimeout(() => { const el = document.getElementById('dse-login'); if (el && !el.value) el.focus(); else document.getElementById('dse-senha-acesso').focus(); }, 100);
}

window._dseToggle = function(inputId, iconId) {
    const inp = document.getElementById(inputId);
    const ic  = document.getElementById(iconId);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; if(ic) ic.className = 'fas fa-eye-slash'; }
    else                         { inp.type = 'password'; if(ic) ic.className = 'fas fa-eye'; }
};

window._dseSalvar = async function() {
    const loginVal  = (document.getElementById('dse-login')?.value || '').trim();
    const senhaAcesso = document.getElementById('dse-senha-acesso')?.value || '';
    const novaSenha   = document.getElementById('dse-nova-senha')?.value || '';
    const confirmSenha= document.getElementById('dse-confirmar-senha')?.value || '';
    const err = document.getElementById('dse-erro');
    const btn = document.getElementById('dse-btn-salvar');

    const showErr = (msg) => {
        if (err) { err.textContent = msg; err.style.display = 'block'; }
    };

    if (!loginVal)    { showErr('Informe seu e-mail de acesso.'); return; }
    if (!senhaAcesso) { showErr('Informe sua senha de acesso.'); return; }

    // Se definindo nova senha, ambos os campos devem coincidir
    if (novaSenha || confirmSenha) {
        if (novaSenha.length < 4) { showErr('A nova senha deve ter no mínimo 4 caracteres.'); return; }
        if (novaSenha !== confirmSenha) { showErr('As senhas não coincidem.'); return; }
    }

    if (err) { err.textContent = ''; err.style.display = 'none'; }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Validando...'; }

    try {
        // Autentica login + senha de acesso via Firebase
        const { signInWithEmailAndPassword } = window._firebaseAPI;
        const auth = window._firebaseAuth;

        if (!auth || !window._firebaseAPI) {
            // Fallback offline: verifica contra sessão
            if (!window._sessaoSenha || senhaAcesso !== window._sessaoSenha) {
                throw new Error('Credenciais de acesso incorretas.');
            }
        } else {
            // Reautentica (não faz novo login — usa reauthenticate se possível)
            if (auth.currentUser) {
                const { EmailAuthProvider, reauthenticateWithCredential } = await import(
                    'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'
                );
                // Garante que o e-mail informado corresponde ao usuário logado
                if (loginVal.toLowerCase() !== (auth.currentUser.email || '').toLowerCase()) {
                    throw new Error('O e-mail informado não corresponde ao usuário logado.');
                }
                const cred = EmailAuthProvider.credential(auth.currentUser.email, senhaAcesso);
                await reauthenticateWithCredential(auth.currentUser, cred);
            } else {
                // Não está logado: tenta autenticar
                await signInWithEmailAndPassword(auth, loginVal, senhaAcesso);
            }
        }

        // Credenciais válidas → salva (ou remove) senha de exclusão
        if (novaSenha) {
            const hash = await _hashSenha(novaSenha);
            localStorage.setItem('cfg_senha_exclusao', hash);
            toast('Senha de exclusão definida com sucesso!', 'success');
        } else {
            localStorage.removeItem('cfg_senha_exclusao');
            toast('Senha de exclusão removida. Usando senha de acesso.', 'success');
        }

        fecharModal('modal-definir-senha-excl');
        // Atualiza o status na tela de configurações
        if (typeof _atualizarStatusSenhaExclusao === 'function') _atualizarStatusSenhaExclusao();

    } catch (e) {
        const msgs = {
            'auth/wrong-password':     'Senha de acesso incorreta.',
            'auth/invalid-credential': 'Credenciais de acesso incorretas.',
            'auth/user-not-found':     'E-mail não encontrado.',
            'auth/too-many-requests':  'Muitas tentativas. Aguarde alguns minutos.',
            'auth/invalid-email':      'Formato de e-mail inválido.',
        };
        showErr(msgs[e.code] || e.message || 'Erro ao validar credenciais.');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Salvar'; }
    }
};

// Atualiza o badge de status na aba Configurações
function _atualizarStatusSenhaExclusao() {
    const statusEl = document.getElementById('cfg-senha-excl-status-txt');
    const statusBox = document.getElementById('cfg-senha-excl-status');
    const btnTxt    = document.getElementById('cfg-senha-excl-btn-txt');
    const temCustom = !!localStorage.getItem('cfg_senha_exclusao');
    if (statusEl) {
        statusEl.textContent = temCustom
            ? '🔐 Senha personalizada definida'
            : '🔓 Usando senha de acesso (padrão)';
    }
    if (statusBox) {
        statusBox.style.background = temCustom ? '#e8f8f5' : '#f4f6f8';
        const ic = statusBox.querySelector('i');
        if (ic) { ic.className = temCustom ? 'fas fa-check-circle' : 'fas fa-info-circle'; ic.style.color = temCustom ? '#1abc9c' : '#bbb'; }
    }
    if (btnTxt) btnTxt.textContent = temCustom ? 'Alterar Senha' : 'Definir Senha';
}
window._atualizarStatusSenhaExclusao = _atualizarStatusSenhaExclusao;

function abrirMesPicker() {
    const grid = document.getElementById('mes-picker-grid');
    grid.innerHTML = `<button class="mes-picker-btn${_mesSel===null?' mes-picker-ativo':''}" onclick="selecionarMesPicker(null)">Todos</button>` +
        MESES_FULL.map((m,i) => `<button class="mes-picker-btn${_mesSel===i?' mes-picker-ativo':''}" onclick="selecionarMesPicker(${i})">${MESES_ABREV[i]}</button>`).join('');
    document.getElementById('modal-mes-picker').classList.remove('hidden');
}

function selecionarMesPicker(idx) {
    _mesSel = idx; _atualizarHeaderMes();
    localStorage.setItem('cfg_mes', JSON.stringify(_mesSel));
    fecharModal('modal-mes-picker');
    if (typeof renderizarDespesas === 'function') renderizarDespesas(); 
    if (typeof renderizarAPagar === 'function') renderizarAPagar(); 
    if (typeof renderizarReceitas === 'function') renderizarReceitas(); 
    if (typeof renderizarAnalise === 'function') renderizarAnalise();
}

function _sincronizarAnoConfig() {
    const sel = document.getElementById('config-ano-select');
    if (sel) sel.value = _anoSel;
}

function _atualizarDataHoje() {
    const hoje = new Date();
    const dia = String(hoje.getDate()).padStart(2,'0');
    const mes = MESES_ABREV[hoje.getMonth()];
    const el = document.getElementById('header-data-hoje');
    if (el) el.textContent = `${dia}/${mes}`;
}

// ==========================================
// TOAST & MODAIS
// ==========================================
function toast(msg, tipo='success') {
    const t=document.getElementById('toast');
    if(t) {
        t.textContent=msg; t.className=`toast toast-${tipo}`;
        t.classList.remove('hidden');
        setTimeout(()=>t.classList.add('hidden'),2800);
    } else {
        console.log(`[Toast ${tipo.toUpperCase()}]: ${msg}`);
    }
}

function fecharModal(id) { 
    const m = document.getElementById(id);
    if(m) m.classList.add('hidden'); 
}

document.querySelectorAll('.modal-overlay').forEach(el => {
    el.addEventListener('click', e => { if(e.target===el) el.classList.add('hidden'); });
});

function _pickerCor(scope, hiddenId, el) {
    document.querySelectorAll(`${scope} .color-opt`).forEach(c=>c.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById(hiddenId).value = el.dataset.color;
}
function selecionarCor(el)       { _pickerCor('#modal-cartao',  'cartao-cor', el); }
function selecionarCorCat(el)    { _pickerCor('#modal-categoria','cat-cor', el); }
function selecionarIcone(el) {
    document.querySelectorAll('.icon-opt').forEach(i=>i.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('cat-icone').value = el.dataset.icon;
}
function _resetPicker(scope, hiddenId, defaultColor) {
    document.querySelectorAll(`${scope} .color-opt`).forEach((el,i) => {
        el.classList.toggle('selected', el.dataset.color===defaultColor);
    });
    const hd = document.getElementById(hiddenId);
    if(hd) hd.value = defaultColor;
}

// ==========================================
// DESPESAS (gastos realizados)
// ==========================================
function _populateDespesaSelects() {
    const cats    = getData('cat_despesas');
    const cartoes = getData('cartoes');
    const tipos   = getData('tipos_despesa');
    
    const catEl = document.getElementById('despesa-categoria');
    if(catEl) {
        catEl.innerHTML = '<option value="">Sem categoria</option>' + cats.map(c=>`<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
    }
    
    const tpEl = document.getElementById('despesa-tipo-pagamento');
    if(tpEl) {
        const optsCartoes = cartoes.map(c=>`<option value="cartao_${c.id}">💳 ${c.nome}</option>`).join('');
        const optsTipos   = tipos.map(t=>`<option value="tipo_${t.id}">${t.icone} ${t.nome}</option>`).join('');
        tpEl.innerHTML = '<option value="">Selecione...</option>' + optsCartoes + optsTipos;
    }
}

function abrirModalDespesa(id=null) {
    const tit = document.getElementById('modal-despesa-titulo');
    if(tit) tit.textContent = id ? 'Editar Despesa' : 'Nova Despesa';
    
    ['despesa-edit-id','despesa-descricao','despesa-local','despesa-obs'].forEach(i => {
        const el = document.getElementById(i);
        if(el) el.value='';
    });
    
    const valEl = document.getElementById('despesa-valor');
    if(valEl) valEl.value = '';
    
    const dtEl = document.getElementById('despesa-data');
    if(dtEl) dtEl.value = new Date().toISOString().slice(0,10);
    
    _populateDespesaSelects();
    
    if (id) {
        const r = getData('despesas_gastos').find(x=>x.id===id);
        if (r) {
            document.getElementById('despesa-edit-id').value = r.id;
            document.getElementById('despesa-descricao').value = r.descricao;
            document.getElementById('despesa-valor').value = r.valor;
            document.getElementById('despesa-data').value = r.data;
            document.getElementById('despesa-categoria').value = r.categoriaId||'';
            document.getElementById('despesa-tipo-pagamento').value = r.tipoPagamentoVal||'';
            document.getElementById('despesa-local').value = r.local||'';
            document.getElementById('despesa-obs').value = r.obs||'';
        }
    }
    const modal = document.getElementById('modal-despesa');
    if(modal) modal.classList.remove('hidden');
}

function salvarDespesa() {
    const desc  = document.getElementById('despesa-descricao').value.trim();
    const valor = parseFloat(document.getElementById('despesa-valor').value);
    const data  = document.getElementById('despesa-data').value;
    
    if (!desc)  { toast('Informe a descrição.','error'); return; }
    if (!valor) { toast('Informe o valor.','error'); return; }
    if (!data)  { toast('Informe a data.','error'); return; }

    const catId  = document.getElementById('despesa-categoria').value;
    const cat    = getData('cat_despesas').find(x=>x.id===catId);
    const tpVal  = document.getElementById('despesa-tipo-pagamento').value;
    let tipoPagamentoNome = '';
    
    // AQUI ESTAVA O TEU ERRO ANTIGO (AGORA ESTÁ  CORRIGIDO)
    if (tpVal && tpVal.startsWith('cartao_')) {
        const idCartao = tpVal.replace('cartao_', '');
        const c = getData('cartoes').find(x => x.id === idCartao);
        if (c) tipoPagamentoNome = c.nome;
    } else if (tpVal && tpVal.startsWith('tipo_')) {
        const idTipo = tpVal.replace('tipo_', '');
        const t = getData('tipos_despesa').find(x => x.id === idTipo);
        if (t) tipoPagamentoNome = t.nome;
    }

    // Criar objeto da despesa
    const novaDespesa = {
        id: document.getElementById('despesa-edit-id').value || uid(),
        descricao: desc,
        valor: valor,
        data: data,
        categoriaId: catId,
        tipoPagamentoVal: tpVal,
        tipoPagamentoNome: tipoPagamentoNome,
        local: document.getElementById('despesa-local').value,
        obs: document.getElementById('despesa-obs').value
    };

    // Salvar na memória (localStorage)
    const despesas = getData('despesas_gastos', []);
    const editId = document.getElementById('despesa-edit-id').value;
    if (editId) {
        const idx = despesas.findIndex(x => x.id === editId);
        if (idx > -1) despesas[idx] = novaDespesa;
    } else {
        despesas.push(novaDespesa);
    }
    localStorage.setItem('despesas_gastos', JSON.stringify(despesas));

    toast('Despesa salva com sucesso!', 'success');
    fecharModal('modal-despesa');
    
    // Atualizar ecrãs se as funções existirem noutros ficheiros
    if (typeof renderizarDespesas === 'function') renderizarDespesas();
    if (typeof renderizarAnalise === 'function') renderizarAnalise();
}
function toggleNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (!panel) return;
    panel.classList.toggle('hidden');
}


function fecharNotifPanel() {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.add('hidden');
}

// ==========================================
// NAVEGAÇÃO POR ENTER NOS MODAIS
// ==========================================
// NAVEGAÇÃO POR ENTER + SELECTS COM DROPDOWN CUSTOMIZADO
// ==========================================
(function _instalarNavegacaoEnter() {
    const FOCUSABLE = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

    // ── Estado do dropdown customizado ──────────────────────────────────────
    let _dropEl     = null;   // <select> que originou o dropdown
    let _dropDiv    = null;   // div flutuante com as opções
    let _dropIdx    = -1;     // índice da opção destacada

    // ── Helpers ──────────────────────────────────────────────────────────────
    function _getCampos(modal) {
        return Array.from(modal.querySelectorAll(FOCUSABLE)).filter(f => {
            if (f.offsetParent === null) return false;
            if (f.closest('[style*="display:none"], [style*="display: none"]')) return false;
            return true;
        });
    }

    function _avancar(modal, el) {
        const campos = _getCampos(modal);
        const idx    = campos.indexOf(el);
        const prox   = campos[idx + 1];
        if (prox) {
            prox.focus();
            if (prox.tagName === 'SELECT') _abrirDropdown(prox);
        } else {
            const btn = modal.querySelector('.btn-save, button[onclick*="salvar"], button[type="submit"]');
            if (btn) btn.click();
        }
    }

    // ── Dropdown customizado ─────────────────────────────────────────────────
    function _fecharDropdown() {
        if (_dropDiv) { _dropDiv.remove(); _dropDiv = null; }
        _dropEl  = null;
        _dropIdx = -1;
    }

    function _abrirDropdown(sel) {
        _fecharDropdown();
        _dropEl = sel;

        const rect = sel.getBoundingClientRect();
        const div  = document.createElement('div');
        div.className = 'custom-select-dropdown';
        div.style.cssText = `
            position: fixed;
            z-index: 99999;
            left: ${rect.left}px;
            top: ${rect.bottom + 2}px;
            min-width: ${rect.width}px;
            max-width: ${Math.max(rect.width, 280)}px;
            background: #fff;
            border: 1px solid #d0d6de;
            border-radius: 10px;
            box-shadow: 0 8px 28px rgba(0,0,0,0.16);
            overflow: hidden;
            max-height: 280px;
            overflow-y: auto;
        `;

        const opts = Array.from(sel.options);
        let selectedIdx = sel.selectedIndex >= 0 ? sel.selectedIndex : 0;

        opts.forEach((opt, i) => {
            const item = document.createElement('div');
            item.className = 'custom-select-item';
            item.textContent = opt.text;
            item.dataset.idx = i;
            item.style.cssText = `
                padding: 10px 14px;
                cursor: pointer;
                font-size: 14px;
                color: #2c3e50;
                border-left: 3px solid transparent;
                transition: background 0.15s;
            `;
            if (i === selectedIdx) {
                item.style.background = '#ebf5fb';
                item.style.borderLeftColor = '#3498db';
                item.style.fontWeight = '600';
                _dropIdx = i;
            }
            item.addEventListener('mouseenter', () => _highlight(i));
            item.addEventListener('click', () => _confirmar(i));
            div.appendChild(item);
        });

        document.body.appendChild(div);
        _dropDiv = div;

        // Scroll para item selecionado
        const highlighted = div.querySelector(`[data-idx="${selectedIdx}"]`);
        if (highlighted) highlighted.scrollIntoView({ block: 'nearest' });
    }

    function _highlight(i) {
        if (!_dropDiv) return;
        _dropIdx = i;
        Array.from(_dropDiv.children).forEach((item, j) => {
            if (j === i) {
                item.style.background = '#ebf5fb';
                item.style.borderLeftColor = '#3498db';
                item.style.fontWeight = '600';
            } else {
                item.style.background = '';
                item.style.borderLeftColor = 'transparent';
                item.style.fontWeight = '';
            }
        });
    }

    function _confirmar(i) {
        if (!_dropEl) return;
        const prev = _dropEl.value;
        _dropEl.selectedIndex = i;
        // Dispara change se o valor mudou
        if (_dropEl.value !== prev || true) {
            _dropEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        const modal = _dropEl.closest('.modal-overlay, .modal-box');
        const sel   = _dropEl;
        _fecharDropdown();
        if (modal) _avancar(modal, sel);
    }

    // ── Evento keydown global ────────────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        // Navegação dentro do dropdown aberto
        if (_dropDiv) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                const next = Math.min(_dropIdx + 1, _dropEl.options.length - 1);
                _highlight(next);
                _dropDiv.children[next]?.scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                const prev = Math.max(_dropIdx - 1, 0);
                _highlight(prev);
                _dropDiv.children[prev]?.scrollIntoView({ block: 'nearest' });
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                if (_dropIdx >= 0) _confirmar(_dropIdx);
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                const sel = _dropEl;
                _fecharDropdown();
                sel?.focus();
                return;
            }
            // Teclas de letra: busca opção que começa com a letra
            if (e.key.length === 1) {
                const letra = e.key.toLowerCase();
                const opts  = Array.from(_dropEl.options);
                const start = (_dropIdx + 1) % opts.length;
                for (let d = 0; d < opts.length; d++) {
                    const k = (start + d) % opts.length;
                    if (opts[k].text.toLowerCase().startsWith(letra)) {
                        _highlight(k);
                        _dropDiv.children[k]?.scrollIntoView({ block: 'nearest' });
                        break;
                    }
                }
                return;
            }
            return;
        }

        if (e.key !== 'Enter') return;

        const el    = e.target;
        const modal = el.closest('.modal-overlay, .modal-box');
        if (!modal) return;

        // Textarea: Enter = nova linha
        if (el.tagName === 'TEXTAREA') return;
        // Checkbox/radio: padrão
        if (el.type === 'checkbox' || el.type === 'radio') return;

        // Select com foco: abre dropdown customizado
        if (el.tagName === 'SELECT') {
            e.preventDefault();
            _abrirDropdown(el);
            return;
        }

        e.preventDefault();
        _avancar(modal, el);
    });

    // Fecha dropdown ao clicar fora
    document.addEventListener('mousedown', function (e) {
        if (_dropDiv && !_dropDiv.contains(e.target) && e.target !== _dropEl) {
            _fecharDropdown();
        }
    });

    // Fecha dropdown ao rolar a página
    document.addEventListener('scroll', _fecharDropdown, true);

    // Ao focar um select com Tab, abre dropdown automaticamente
    document.addEventListener('focusin', function (e) {
        const el    = e.target;
        const modal = el.closest('.modal-overlay, .modal-box');
        if (!modal) return;
        if (el.tagName === 'SELECT') {
            // Pequeno delay para Tab terminar de mover o foco
            setTimeout(() => { if (document.activeElement === el) _abrirDropdown(el); }, 80);
        }
    });
})();

// ==========================================
// NOTIFICAÇÕES PUSH — FCM (app fechado)
// ==========================================
;(function _notificacoesPush() {

    const NOTIF_KEY    = 'notif_push_ativa';
    const NOTIF_TOKEN  = 'notif_fcm_token';
    const NOTIF_VISTAS = 'notif_ids_vistos';
    const CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hora

    let _messagingInstance = null;

    // ── Suporte ───────────────────────────────────────────────────────────────
    function _suportado() {
        return ('Notification' in window) && ('serviceWorker' in navigator);
    }

    // ── Obtém instância do Firebase Messaging ─────────────────────────────────
    async function _getMessaging() {
        if (_messagingInstance) return _messagingInstance;
        const [{ getMessaging, getToken, onMessage }, swReg] = await Promise.all([
            import('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging.js'),
            navigator.serviceWorker.register('./firebase-messaging-sw.js', { scope: './' })
        ]);
        _messagingInstance = { sdk: { getMessaging, getToken, onMessage }, swReg };
        const app = window._firebaseApp;
        if (!app) throw new Error('Firebase app não inicializado.');
        _messagingInstance.m = getMessaging(app);
        _messagingInstance.getToken  = getToken;
        _messagingInstance.onMessage = onMessage;
        return _messagingInstance;
    }

    // ── Chama Cloud Function callable ────────────────────────────────────────
    async function _callFunction(nome, dados) {
        const { getFunctions, httpsCallable } = await import(
            'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js'
        );
        const fns = getFunctions(window._firebaseApp, 'us-central1');
        const fn  = httpsCallable(fns, nome);
        return fn(dados);
    }

    // ── Registra token FCM no Firestore via Cloud Function ────────────────────
    async function _registrarToken(token) {
        const tokenSalvo = localStorage.getItem(NOTIF_TOKEN);
        if (tokenSalvo === token) return; // já registrado
        const dispositivo = /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
        await _callFunction('registrarTokenFCM', { token, dispositivo });
        localStorage.setItem(NOTIF_TOKEN, token);
        console.log('[FCM] Token registrado no Firestore.');
    }

    // ── Remove token FCM do Firestore ─────────────────────────────────────────
    async function _removerToken() {
        const token = localStorage.getItem(NOTIF_TOKEN);
        if (!token) return;
        try {
            await _callFunction('removerTokenFCM', { token });
        } catch (e) { console.warn('[FCM] Erro ao remover token:', e); }
        localStorage.removeItem(NOTIF_TOKEN);
        console.log('[FCM] Token removido do Firestore.');
    }

    // ── Solicita permissão e obtém token FCM ─────────────────────────────────
    async function _ativar() {
        if (!_suportado()) { toast('Navegador não suporta notificações.', 'error'); return false; }

        if (Notification.permission === 'denied') {
            toast('Notificações bloqueadas. Habilite nas configurações do navegador.', 'error');
            return false;
        }

        const perm = await Notification.requestPermission();
        if (perm !== 'granted') { toast('Permissão negada.', 'error'); return false; }

        try {
            const mi = await _getMessaging();

            // VAPID key — obtida no Firebase Console → Configurações do projeto → Cloud Messaging → Certificados Web Push
            const VAPID_KEY = window.FIREBASE_VAPID_KEY || '';

            const token = await mi.getToken(mi.m, {
                vapidKey:            VAPID_KEY,
                serviceWorkerRegistration: mi.swReg
            });

            if (!token) throw new Error('Token FCM vazio — verifique a VAPID key.');

            await _registrarToken(token);

            // Escuta mensagens com app ABERTO (foreground)
            mi.onMessage(mi.m, (payload) => {
                const titulo = payload.notification?.title || '💰 Finanças LHSC';
                const corpo  = payload.notification?.body  || '';
                toast(`🔔 ${titulo}: ${corpo}`, 'success');
            });

            return true;
        } catch (e) {
            console.error('[FCM] Erro ao ativar:', e);
            toast('Erro ao ativar notificações. Verifique o console.', 'error');
            return false;
        }
    }

    // ── Liga/desliga notificações ─────────────────────────────────────────────
    window.toggleNotificacoesPush = async function () {
        const ativa = localStorage.getItem(NOTIF_KEY) === 'true';
        if (ativa) {
            await _removerToken();
            localStorage.setItem(NOTIF_KEY, 'false');
            _atualizarBtnNotifPush();
            toast('Notificações desativadas.', 'success');
        } else {
            const ok = await _ativar();
            if (ok) {
                localStorage.setItem(NOTIF_KEY, 'true');
                _atualizarBtnNotifPush();
                toast('Notificações ativadas! Você receberá alertas diários às 8h.', 'success');
                _verificarENotificarLocal();
            }
        }
    };

    // ── Atualiza botão na aba Configurações ───────────────────────────────────
    function _atualizarBtnNotifPush() {
        const btn  = document.getElementById('btn-notif-push');
        const txt  = document.getElementById('btn-notif-push-txt');
        const ic   = document.getElementById('btn-notif-push-ic');
        const ativa = Notification.permission === 'granted' &&
                      localStorage.getItem(NOTIF_KEY) === 'true';
        if (txt) txt.textContent = ativa ? 'Desativar Notificações' : 'Ativar Notificações';
        if (ic)  ic.className    = ativa ? 'fas fa-bell-slash' : 'fas fa-bell';
        if (btn) {
            btn.classList.toggle('btn-danger',  ativa);
            btn.classList.toggle('btn-primary', !ativa);
        }
        const statusTxt = document.getElementById('notif-push-status-txt');
        if (statusTxt) {
            if (Notification.permission === 'denied') {
                statusTxt.textContent = '🚫 Bloqueado pelo navegador';
            } else {
                statusTxt.textContent = ativa ? '🔔 Ativadas — alertas diários às 8h' : '🔕 Desativadas';
            }
        }
    }
    window._atualizarBtnNotifPush = _atualizarBtnNotifPush;

    // ── Verificação LOCAL (com app aberto) — complementa o FCM ───────────────
    function _verificarENotificarLocal() {
        if (Notification.permission !== 'granted') return;
        if (localStorage.getItem(NOTIF_KEY) !== 'true') return;

        const hoje = new Date().toISOString().slice(0, 10);
        let vistos;
        try { vistos = JSON.parse(localStorage.getItem(NOTIF_VISTAS) || '{}'); } catch { vistos = {}; }
        if (vistos._data !== hoje) vistos = { _data: hoje };

        const expandidas = typeof _expandirAPagar === 'function'
            ? _expandirAPagar(getData('a_pagar', []))
            : getData('a_pagar', []);

        const hoje_d = new Date(); hoje_d.setHours(0,0,0,0);
        const em3    = new Date(hoje_d); em3.setDate(em3.getDate() + 3);

        expandidas.forEach(item => {
            if (item.pago) return;
            const nome  = item._isParcelado ? item._parcelaNome : item.descricao;
            const valor = item._valorParcela || parseFloat(item.valor) || 0;
            const venc  = new Date((item.vencimento || '') + 'T00:00:00');
            const tag   = `${item._instanciaId || item.id}`;

            const enviar = (titulo, corpo, sufixo) => {
                const k = tag + sufixo;
                if (vistos[k]) return;
                vistos[k] = true;
                navigator.serviceWorker.ready.then(reg => {
                    reg.showNotification(titulo, {
                        body: corpo, icon: './icon-192.png', badge: './icon-192.png',
                        tag: k, vibrate: [200,100,200], data: { url: './' }
                    });
                }).catch(() => {
                    try { new Notification(titulo, { body: corpo, icon: './icon-192.png' }); } catch(_) {}
                });
            };

            if (venc < hoje_d) {
                enviar('⚠️ Conta vencida',
                    `${nome} — ${brl(valor)} (venceu em ${typeof _fmtData === 'function' ? _fmtData(item.vencimento) : item.vencimento})`,
                    '_venc');
            } else if (venc <= em3) {
                const dias = Math.ceil((venc - hoje_d) / 86400000);
                const label = dias === 0 ? 'hoje' : dias === 1 ? 'amanhã' : `em ${dias} dias`;
                enviar('📅 Conta próxima', `${nome} — ${brl(valor)} vence ${label}`, '_prox');
            }
        });

        localStorage.setItem(NOTIF_VISTAS, JSON.stringify(vistos));
    }

    // ── Re-registra o token quando o usuário logar ────────────────────────────
    // (garante que o token está sempre válido no Firestore)
    async function _reativarSeAtivo() {
        if (localStorage.getItem(NOTIF_KEY) !== 'true') return;
        if (Notification.permission !== 'granted') return;
        try {
            const mi    = await _getMessaging();
            const VAPID = window.FIREBASE_VAPID_KEY || '';
            const token = await mi.getToken(mi.m, {
                vapidKey: VAPID,
                serviceWorkerRegistration: mi.swReg
            });
            if (token) {
                await _registrarToken(token);
                mi.onMessage(mi.m, (payload) => {
                    const t = payload.notification?.title || '💰 Finanças LHSC';
                    const b = payload.notification?.body  || '';
                    toast(`🔔 ${t}: ${b}`, 'success');
                });
            }
        } catch(e) { console.warn('[FCM] Re-ativação falhou:', e); }
        _verificarENotificarLocal();
        setInterval(_verificarENotificarLocal, CHECK_INTERVAL_MS);
    }

    // ── Inicia quando o usuário logar ─────────────────────────────────────────
    window.addEventListener('firebaseReady', () => {
        setTimeout(() => {
            const auth = window._firebaseAuth;
            if (!auth) return;
            import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js')
                .then(({ onAuthStateChanged }) => {
                    onAuthStateChanged(auth, user => {
                        if (user) {
                            _reativarSeAtivo();
                            _atualizarBtnNotifPush();
                        } else {
                            localStorage.removeItem(NOTIF_TOKEN);
                        }
                    });
                });
        }, 800);
    });

    // Atualiza botão ao abrir Configurações
    const _origRenderConf = window.renderizarConfiguracoes;
    if (typeof _origRenderConf === 'function') {
        window.renderizarConfiguracoes = function () {
            _origRenderConf();
            _atualizarBtnNotifPush();
        };
    }

})();
