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
    el.classList.add('active');
    document.querySelectorAll('.content-section').forEach(s => s.classList.add('hidden'));
    document.getElementById('content-' + id).classList.remove('hidden');
    const renders = {
        analise: renderizarAnalise, despesas: renderizarDespesas, 'a-pagar': renderizarAPagar,
        receita: renderizarReceitas, dados: renderizarDados, configuracoes: renderizarConfiguracoes
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
