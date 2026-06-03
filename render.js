// ==========================================
// render.js — Funções de renderização e CRUD
// Sistema Financeiro LHSC
// ==========================================

// ==========================================
// UTILITÁRIOS LOCAIS
// ==========================================
function _fmtData(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
}

function _statusAPagar(item) {
    if (item.pago) return 'pago';
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(item.vencimento + 'T00:00:00');
    return venc < hoje ? 'vencido' : 'pendente';
}

function _filtrarPorMes(lista, campoData) {
    const mes = getMesSel();
    const ano = getAnoSel();
    if (mes === null) return lista;
    return lista.filter(i => {
        const d = new Date((i[campoData] || '') + 'T00:00:00');
        return d.getMonth() === mes && d.getFullYear() === ano;
    });
}

// ==========================================
// CONFIGURAÇÕES
// ==========================================
function salvarAnoConfig(val) {
    _anoSel = parseInt(val) || new Date().getFullYear();
    localStorage.setItem('cfg_ano', JSON.stringify(_anoSel));
    _atualizarHeaderMes();
    renderizarAnalise();
}

function renderizarConfiguracoes() {
    const sel = document.getElementById('config-ano-select');
    if (!sel) return;
    const anoAtual = new Date().getFullYear();
    sel.innerHTML = '';
    for (let a = anoAtual - 3; a <= anoAtual + 2; a++) {
        const opt = document.createElement('option');
        opt.value = a; opt.textContent = a;
        if (a === getAnoSel()) opt.selected = true;
        sel.appendChild(opt);
    }
}

// ==========================================
// NOTIFICAÇÕES
// ==========================================
function atualizarIconeNotificacao() {
    const badge  = document.getElementById('notif-badge');
    const btn    = document.getElementById('notif-btn');
    const lista  = document.getElementById('notif-panel-lista');
    const hoje   = new Date(); hoje.setHours(0,0,0,0);
    const em3    = new Date(hoje); em3.setDate(em3.getDate() + 3);

    const apagarItems = getData('a_pagar', []);
    const notifs = [];

    apagarItems.forEach(item => {
        const status = _statusAPagar(item);
        if (status === 'vencido') {
            notifs.push({ tipo: 'vencido', msg: `<strong>${item.descricao}</strong> venceu em ${_fmtData(item.vencimento)} (${brl(item.valor)})` });
        } else if (status === 'pendente') {
            const venc = new Date(item.vencimento + 'T00:00:00');
            if (venc <= em3) {
                notifs.push({ tipo: 'proximo', msg: `<strong>${item.descricao}</strong> vence em ${_fmtData(item.vencimento)} (${brl(item.valor)})` });
            }
        }
    });

    if (badge) {
        badge.textContent = notifs.length;
        badge.classList.toggle('hidden', notifs.length === 0);
    }
    if (btn) btn.classList.toggle('has-notif', notifs.length > 0);

    if (lista) {
        if (notifs.length === 0) {
            lista.innerHTML = '<div class="notif-empty"><i class="fas fa-check-circle"></i><p>Nenhuma notificação pendente</p></div>';
        } else {
            lista.innerHTML = notifs.map(n => `
                <div class="notif-item notif-item--${n.tipo}">
                    <i class="fas fa-${n.tipo === 'vencido' ? 'exclamation-triangle' : 'clock'}"></i>
                    <span>${n.msg}</span>
                </div>`).join('');
        }
    }
}

function recuperarSenha(e) {
    e && e.preventDefault();
    const email = document.getElementById('username').value.trim();
    if (!email) { toast('Digite seu e-mail primeiro.', 'error'); return; }
    if (window._firebaseAPI && window._firebaseAuth) {
        const { sendPasswordResetEmail } = window._firebaseAPI;
        sendPasswordResetEmail(window._firebaseAuth, email)
            .then(() => toast('E-mail de recuperação enviado!', 'success'))
            .catch(() => toast('Não foi possível enviar o e-mail.', 'error'));
    } else {
        toast('Serviço indisponível. Tente novamente.', 'error');
    }
}

// ==========================================
// RENDERIZAR DESPESAS
// ==========================================
function renderizarDespesas() {
    const lista    = document.getElementById('lista-despesas');
    const totalEl  = document.getElementById('despesas-total');
    const filtroC  = document.getElementById('filtro-despesa-cat');
    if (!lista) return;

    // Atualizar filtro de categorias
    const cats = getData('cat_despesas');
    if (filtroC) {
        const prev = filtroC.value;
        filtroC.innerHTML = '<option value="">Todas as categorias</option>' +
            cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
        filtroC.value = prev;
    }

    let despesas = _filtrarPorMes(getData('despesas_gastos'), 'data');

    // Filtro categoria
    const catFiltro = filtroC ? filtroC.value : '';
    if (catFiltro) despesas = despesas.filter(d => d.categoriaId === catFiltro);

    // Ordenar por data desc
    despesas.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const total = despesas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
    if (totalEl) totalEl.textContent = brl(total);

    if (despesas.length === 0) {
        lista.innerHTML = '<div class="registros-empty"><i class="fas fa-receipt"></i><p>Nenhuma despesa no período.</p></div>';
        return;
    }

    lista.innerHTML = despesas.map(d => {
        const cat = cats.find(c => c.id === d.categoriaId);
        const icone = cat ? cat.icone : '💰';
        const cor   = cat ? cat.cor   : '#95a5a6';
        const sub   = [d.local, d.tipoPagamentoNome].filter(Boolean).join(' · ');
        return `
        <div class="reg-item">
            <div class="reg-icon" style="background:${cor}22; color:${cor}">${icone}</div>
            <div class="reg-info">
                <span class="reg-nome">${d.descricao}</span>
                <span class="reg-sub">${_fmtData(d.data)}${sub ? ' · ' + sub : ''}</span>
            </div>
            <div class="reg-meio">
                ${cat ? `<span class="reg-tipo-tag">${cat.nome}</span>` : ''}
                ${d.tipoPagamentoNome ? `<span class="reg-tipo-tag">${d.tipoPagamentoNome}</span>` : ''}
            </div>
            <span class="reg-valor text-danger">${brl(d.valor)}</span>
            <div class="reg-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalDespesa('${d.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirDespesa('${d.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function excluirDespesa(id) {
    if (!confirm('Excluir esta despesa?')) return;
    const arr = getData('despesas_gastos').filter(x => x.id !== id);
    localStorage.setItem('despesas_gastos', JSON.stringify(arr));
    renderizarDespesas();
    renderizarAnalise();
    toast('Despesa excluída.', 'success');
}

// ==========================================
// RENDERIZAR A PAGAR
// ==========================================
function _populateAPagarSelects() {
    const cats  = getData('cat_despesas');
    const tipos = getData('tipos_despesa');
    const cartoes = getData('cartoes');

    const catEl = document.getElementById('apagar-categoria');
    if (catEl) catEl.innerHTML = '<option value="">Sem categoria</option>' +
        cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');

    const tpEl = document.getElementById('apagar-tipo-pagamento');
    if (tpEl) {
        const optsC = cartoes.map(c => `<option value="cartao_${c.id}">💳 ${c.nome}</option>`).join('');
        const optsT = tipos.map(t => `<option value="tipo_${t.id}">${t.icone} ${t.nome}</option>`).join('');
        tpEl.innerHTML = '<option value="">Selecione...</option>' + optsC + optsT;
    }
}

function _toggleParcelas() {
    const tipo = document.getElementById('apagar-tipo');
    const row  = document.getElementById('row-parcelas');
    if (row) row.style.display = (tipo && tipo.value === 'Parcelado') ? '' : 'none';
}

function abrirModalAPagar(id = null) {
    const tit = document.getElementById('modal-apagar-titulo');
    if (tit) tit.textContent = id ? 'Editar Despesa' : 'Nova Despesa';

    ['apagar-edit-id','apagar-descricao','apagar-obs'].forEach(i => {
        const el = document.getElementById(i); if (el) el.value = '';
    });
    const valEl = document.getElementById('apagar-valor');
    if (valEl) valEl.value = '';
    const dtEl = document.getElementById('apagar-vencimento');
    if (dtEl) dtEl.value = new Date().toISOString().slice(0, 10);
    const pagoEl = document.getElementById('apagar-pago');
    if (pagoEl) pagoEl.checked = false;
    const tipoEl = document.getElementById('apagar-tipo');
    if (tipoEl) tipoEl.value = 'Fixo';
    _toggleParcelas();
    _populateAPagarSelects();

    if (id) {
        const r = getData('a_pagar').find(x => x.id === id);
        if (r) {
            document.getElementById('apagar-edit-id').value = r.id;
            document.getElementById('apagar-descricao').value = r.descricao;
            document.getElementById('apagar-valor').value = r.valor;
            document.getElementById('apagar-vencimento').value = r.vencimento;
            document.getElementById('apagar-categoria').value = r.categoriaId || '';
            document.getElementById('apagar-tipo-pagamento').value = r.tipoPagamentoVal || '';
            document.getElementById('apagar-tipo').value = r.tipo || 'Fixo';
            document.getElementById('apagar-obs').value = r.obs || '';
            document.getElementById('apagar-pago').checked = !!r.pago;
            if (r.tipo === 'Parcelado') {
                document.getElementById('row-parcelas').style.display = '';
                document.getElementById('apagar-parcelas').value = r.parcelas || 1;
            }
        }
    }
    const modal = document.getElementById('modal-a-pagar');
    if (modal) modal.classList.remove('hidden');
}

function salvarAPagar() {
    const desc  = document.getElementById('apagar-descricao').value.trim();
    const valor = parseFloat(document.getElementById('apagar-valor').value);
    const venc  = document.getElementById('apagar-vencimento').value;

    if (!desc)  { toast('Informe a descrição.', 'error'); return; }
    if (!valor) { toast('Informe o valor.', 'error'); return; }
    if (!venc)  { toast('Informe o vencimento.', 'error'); return; }

    const catId  = document.getElementById('apagar-categoria').value;
    const tpVal  = document.getElementById('apagar-tipo-pagamento').value;
    let tipoPagamentoNome = '';
    if (tpVal.startsWith('cartao_')) {
        const c = getData('cartoes').find(x => x.id === tpVal.replace('cartao_', ''));
        if (c) tipoPagamentoNome = c.nome;
    } else if (tpVal.startsWith('tipo_')) {
        const t = getData('tipos_despesa').find(x => x.id === tpVal.replace('tipo_', ''));
        if (t) tipoPagamentoNome = t.nome;
    }

    const tipoVal = document.getElementById('apagar-tipo').value;
    const item = {
        id: document.getElementById('apagar-edit-id').value || uid(),
        descricao: desc,
        valor,
        vencimento: venc,
        categoriaId: catId,
        tipoPagamentoVal: tpVal,
        tipoPagamentoNome,
        tipo: tipoVal,
        parcelas: tipoVal === 'Parcelado' ? (parseInt(document.getElementById('apagar-parcelas').value) || 1) : null,
        obs: document.getElementById('apagar-obs').value,
        pago: document.getElementById('apagar-pago').checked
    };

    const arr  = getData('a_pagar', []);
    const editId = document.getElementById('apagar-edit-id').value;
    if (editId) {
        const idx = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
    } else {
        arr.push(item);
    }
    localStorage.setItem('a_pagar', JSON.stringify(arr));
    toast('Conta salva com sucesso!', 'success');
    fecharModal('modal-a-pagar');
    renderizarAPagar();
    renderizarAnalise();
    atualizarIconeNotificacao();
}

function renderizarAPagar() {
    const lista   = document.getElementById('lista-a-pagar');
    const totalEl = document.getElementById('apagar-total');
    const filtroS = document.getElementById('filtro-apagar-status');
    const filtroC = document.getElementById('filtro-apagar-cat');
    if (!lista) return;

    const cats = getData('cat_despesas');
    if (filtroC) {
        const prev = filtroC.value;
        filtroC.innerHTML = '<option value="">Todas as categorias</option>' +
            cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
        filtroC.value = prev;
    }

    let items = _filtrarPorMes(getData('a_pagar'), 'vencimento');
    const statusFiltro = filtroS ? filtroS.value : '';
    const catFiltro    = filtroC ? filtroC.value : '';
    if (statusFiltro) items = items.filter(i => _statusAPagar(i) === statusFiltro);
    if (catFiltro)    items = items.filter(i => i.categoriaId === catFiltro);

    items.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

    const total = items.filter(i => !i.pago).reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);
    if (totalEl) totalEl.textContent = brl(total);

    if (items.length === 0) {
        lista.innerHTML = '<div class="registros-empty"><i class="fas fa-file-invoice-dollar"></i><p>Nenhuma conta no período.</p></div>';
        return;
    }

    lista.innerHTML = items.map(item => {
        const status = _statusAPagar(item);
        const cat    = cats.find(c => c.id === item.categoriaId);
        const icone  = cat ? cat.icone : '💸';
        const cor    = cat ? cat.cor   : '#95a5a6';
        const badgeClass = { pago: 'badge-pago', pendente: 'badge-pendente', vencido: 'badge-vencido' }[status];
        const badgeLabel = { pago: 'Pago', pendente: 'Pendente', vencido: 'Vencido' }[status];
        return `
        <div class="reg-item ${item.pago ? 'reg-pago' : ''}">
            <div class="reg-icon" style="background:${cor}22; color:${cor}">${icone}</div>
            <div class="reg-info">
                <span class="reg-nome">${item.descricao}</span>
                <span class="reg-sub">Venc: ${_fmtData(item.vencimento)}${item.tipoPagamentoNome ? ' · ' + item.tipoPagamentoNome : ''}</span>
            </div>
            <div class="reg-meio">
                <span class="badge ${badgeClass}">${badgeLabel}</span>
                <span class="reg-tipo-tag">${item.tipo || ''}</span>
            </div>
            <span class="reg-valor text-danger">${brl(item.valor)}</span>
            <div class="reg-actions">
                ${!item.pago ? `<button class="btn-icon btn-edit" title="Marcar pago" onclick="marcarPago('${item.id}')"><i class="fas fa-check"></i></button>` : ''}
                <button class="btn-icon btn-edit" onclick="abrirModalAPagar('${item.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirAPagar('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function marcarPago(id) {
    const arr = getData('a_pagar');
    const idx = arr.findIndex(x => x.id === id);
    if (idx > -1) { arr[idx].pago = true; }
    localStorage.setItem('a_pagar', JSON.stringify(arr));
    renderizarAPagar();
    renderizarAnalise();
    atualizarIconeNotificacao();
    toast('Conta marcada como paga!', 'success');
}

function excluirAPagar(id) {
    if (!confirm('Excluir esta conta?')) return;
    const arr = getData('a_pagar').filter(x => x.id !== id);
    localStorage.setItem('a_pagar', JSON.stringify(arr));
    renderizarAPagar();
    renderizarAnalise();
    atualizarIconeNotificacao();
    toast('Conta excluída.', 'success');
}

// ==========================================
// RENDERIZAR RECEITAS
// ==========================================
function _populateReceitaSelects() {
    const cats    = getData('cat_receitas');
    const cartoes = getData('cartoes');

    const catEl = document.getElementById('receita-categoria');
    if (catEl) catEl.innerHTML = '<option value="">Sem categoria</option>' +
        cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');

    const contaEl = document.getElementById('receita-conta');
    if (contaEl) contaEl.innerHTML = '<option value="">Nenhuma</option>' +
        cartoes.map(c => `<option value="${c.id}">💳 ${c.nome}</option>`).join('');
}

function abrirModalReceita(id = null) {
    const tit = document.getElementById('modal-receita-titulo');
    if (tit) tit.textContent = id ? 'Editar Receita' : 'Nova Receita';

    ['receita-edit-id','receita-descricao','receita-obs'].forEach(i => {
        const el = document.getElementById(i); if (el) el.value = '';
    });
    const valEl = document.getElementById('receita-valor');
    if (valEl) valEl.value = '';
    const dtEl = document.getElementById('receita-data');
    if (dtEl) dtEl.value = new Date().toISOString().slice(0, 10);
    _populateReceitaSelects();

    if (id) {
        const r = getData('receitas').find(x => x.id === id);
        if (r) {
            document.getElementById('receita-edit-id').value = r.id;
            document.getElementById('receita-descricao').value = r.descricao;
            document.getElementById('receita-valor').value = r.valor;
            document.getElementById('receita-data').value = r.data;
            document.getElementById('receita-categoria').value = r.categoriaId || '';
            document.getElementById('receita-conta').value = r.contaId || '';
            document.getElementById('receita-tipo').value = r.tipo || 'Recorrente';
            document.getElementById('receita-status').value = r.status || 'recebido';
            document.getElementById('receita-obs').value = r.obs || '';
        }
    }
    const modal = document.getElementById('modal-receita');
    if (modal) modal.classList.remove('hidden');
}

function salvarReceita() {
    const desc  = document.getElementById('receita-descricao').value.trim();
    const valor = parseFloat(document.getElementById('receita-valor').value);
    const data  = document.getElementById('receita-data').value;

    if (!desc)  { toast('Informe a descrição.', 'error'); return; }
    if (!valor) { toast('Informe o valor.', 'error'); return; }
    if (!data)  { toast('Informe a data.', 'error'); return; }

    const catId = document.getElementById('receita-categoria').value;
    const item  = {
        id: document.getElementById('receita-edit-id').value || uid(),
        descricao: desc,
        valor,
        data,
        categoriaId: catId,
        contaId: document.getElementById('receita-conta').value,
        tipo: document.getElementById('receita-tipo').value,
        status: document.getElementById('receita-status').value,
        obs: document.getElementById('receita-obs').value
    };

    const arr    = getData('receitas', []);
    const editId = document.getElementById('receita-edit-id').value;
    if (editId) {
        const idx = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
    } else {
        arr.push(item);
    }
    localStorage.setItem('receitas', JSON.stringify(arr));
    toast('Receita salva com sucesso!', 'success');
    fecharModal('modal-receita');
    renderizarReceitas();
    renderizarAnalise();
}

function renderizarReceitas() {
    const lista   = document.getElementById('lista-receitas');
    const totalEl = document.getElementById('receita-total');
    const filtroC = document.getElementById('filtro-receita-cat');
    const filtroM = document.getElementById('filtro-receita-mes');
    if (!lista) return;

    const cats = getData('cat_receitas');
    if (filtroC) {
        const prev = filtroC.value;
        filtroC.innerHTML = '<option value="">Todas as categorias</option>' +
            cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
        filtroC.value = prev;
    }
    if (filtroM) {
        const prev = filtroM.value;
        const MESES_ABREV = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        filtroM.innerHTML = '<option value="">Todos os meses</option>' +
            MESES_ABREV.map((m, i) => `<option value="${i}">${m}</option>`).join('');
        filtroM.value = prev;
    }

    let receitas = _filtrarPorMes(getData('receitas'), 'data');
    const catFiltro = filtroC ? filtroC.value : '';
    const mesFiltro = filtroM ? filtroM.value : '';
    if (catFiltro) receitas = receitas.filter(r => r.categoriaId === catFiltro);
    if (mesFiltro !== '') receitas = receitas.filter(r => {
        const d = new Date((r.data || '') + 'T00:00:00');
        return d.getMonth() === parseInt(mesFiltro);
    });

    receitas.sort((a, b) => (b.data || '').localeCompare(a.data || ''));

    const total = receitas.filter(r => r.status === 'recebido').reduce((s, r) => s + (parseFloat(r.valor) || 0), 0);
    if (totalEl) totalEl.textContent = brl(total);

    if (receitas.length === 0) {
        lista.innerHTML = '<div class="registros-empty"><i class="fas fa-hand-holding-usd"></i><p>Nenhuma receita no período.</p></div>';
        return;
    }

    lista.innerHTML = receitas.map(r => {
        const cat   = cats.find(c => c.id === r.categoriaId);
        const icone = cat ? cat.icone : '📥';
        const cor   = cat ? cat.cor   : '#2ecc71';
        const statusBadge = r.status === 'recebido'
            ? '<span class="badge badge-pago">Recebido</span>'
            : '<span class="badge badge-pendente">Previsto</span>';
        return `
        <div class="reg-item">
            <div class="reg-icon" style="background:${cor}22; color:${cor}">${icone}</div>
            <div class="reg-info">
                <span class="reg-nome">${r.descricao}</span>
                <span class="reg-sub">${_fmtData(r.data)} · ${r.tipo || ''}</span>
            </div>
            <div class="reg-meio">${statusBadge}</div>
            <span class="reg-valor text-success">${brl(r.valor)}</span>
            <div class="reg-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalReceita('${r.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirReceita('${r.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function excluirReceita(id) {
    if (!confirm('Excluir esta receita?')) return;
    const arr = getData('receitas').filter(x => x.id !== id);
    localStorage.setItem('receitas', JSON.stringify(arr));
    renderizarReceitas();
    renderizarAnalise();
    toast('Receita excluída.', 'success');
}

// ==========================================
// RENDERIZAR DADOS (cartões, categorias, etc.)
// ==========================================
function renderizarDados() {
    _renderCartoes();
    _renderCatDespesas();
    _renderCatReceitas();
    _renderTipos();
    _renderMetas();
}

// ---- CARTÕES ----
function abrirModalCartao(id = null) {
    const tit = document.getElementById('modal-cartao-titulo');
    if (tit) tit.textContent = id ? 'Editar Cartão' : 'Novo Cartão de Crédito';

    ['cartao-edit-id','cartao-nome','cartao-digitos'].forEach(i => {
        const el = document.getElementById(i); if (el) el.value = '';
    });
    const limEl = document.getElementById('cartao-limite');
    if (limEl) limEl.value = '';
    const vencEl = document.getElementById('cartao-vencimento');
    if (vencEl) vencEl.value = '';
    _resetPicker('#modal-cartao', 'cartao-cor', '#3498db');

    if (id) {
        const c = getData('cartoes').find(x => x.id === id);
        if (c) {
            document.getElementById('cartao-edit-id').value = c.id;
            document.getElementById('cartao-nome').value = c.nome;
            document.getElementById('cartao-bandeira').value = c.bandeira || 'Visa';
            document.getElementById('cartao-digitos').value = c.digitos || '';
            document.getElementById('cartao-limite').value = c.limite || '';
            document.getElementById('cartao-vencimento').value = c.vencimento || '';
            _resetPicker('#modal-cartao', 'cartao-cor', c.cor || '#3498db');
        }
    }
    const modal = document.getElementById('modal-cartao');
    if (modal) modal.classList.remove('hidden');
}

function salvarCartao() {
    const nome = document.getElementById('cartao-nome').value.trim();
    if (!nome) { toast('Informe o nome do cartão.', 'error'); return; }

    const item = {
        id: document.getElementById('cartao-edit-id').value || uid(),
        nome,
        bandeira: document.getElementById('cartao-bandeira').value,
        digitos: document.getElementById('cartao-digitos').value,
        limite: parseFloat(document.getElementById('cartao-limite').value) || 0,
        vencimento: parseInt(document.getElementById('cartao-vencimento').value) || null,
        cor: document.getElementById('cartao-cor').value
    };

    const arr    = getData('cartoes', []);
    const editId = document.getElementById('cartao-edit-id').value;
    if (editId) {
        const idx = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
    } else {
        arr.push(item);
    }
    localStorage.setItem('cartoes', JSON.stringify(arr));
    toast('Cartão salvo!', 'success');
    fecharModal('modal-cartao');
    _renderCartoes();
    renderizarAnalise();
}

function _renderCartoes() {
    const lista = document.getElementById('lista-cartoes');
    if (!lista) return;
    const cartoes = getData('cartoes');
    if (cartoes.length === 0) {
        lista.innerHTML = '<p class="dados-empty">Nenhum cartão cadastrado ainda.</p>';
        return;
    }
    lista.innerHTML = cartoes.map(c => `
        <div class="dados-item cartao-item">
            <div class="dados-item-info">
                <span class="dados-item-nome" style="color:${c.cor||'#3498db'}">💳 ${c.nome}</span>
                <span class="dados-item-sub">${c.bandeira || ''} ${c.digitos ? '····' + c.digitos : ''} ${c.limite ? '· Limite: ' + brl(c.limite) : ''}</span>
            </div>
            <div class="dados-item-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalCartao('${c.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirCartao('${c.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function excluirCartao(id) {
    if (!confirm('Excluir este cartão?')) return;
    localStorage.setItem('cartoes', JSON.stringify(getData('cartoes').filter(x => x.id !== id)));
    _renderCartoes();
    renderizarAnalise();
    toast('Cartão excluído.', 'success');
}

// ---- CATEGORIAS ----
function abrirModalCategoria(tipo, id = null) {
    const tit = document.getElementById('modal-cat-titulo');
    if (tit) tit.textContent = (id ? 'Editar' : 'Nova') + ' Categoria';
    const tipoEl = document.getElementById('cat-tipo');
    if (tipoEl) tipoEl.value = tipo;

    ['cat-edit-id','cat-nome'].forEach(i => {
        const el = document.getElementById(i); if (el) el.value = '';
    });

    // Reset icon picker
    document.querySelectorAll('#icon-picker .icon-opt').forEach((el, i) => {
        el.classList.toggle('selected', i === 0);
    });
    const iconeEl = document.getElementById('cat-icone');
    if (iconeEl) iconeEl.value = '🏠';
    _resetPicker('#modal-categoria', 'cat-cor', '#3498db');

    if (id) {
        const key = tipo === 'despesa' ? 'cat_despesas' : 'cat_receitas';
        const c = getData(key).find(x => x.id === id);
        if (c) {
            document.getElementById('cat-edit-id').value = c.id;
            document.getElementById('cat-nome').value = c.nome;
            if (iconeEl) iconeEl.value = c.icone || '🏠';
            document.querySelectorAll('#icon-picker .icon-opt').forEach(el => {
                el.classList.toggle('selected', el.dataset.icon === c.icone);
            });
            _resetPicker('#modal-categoria', 'cat-cor', c.cor || '#3498db');
        }
    }
    const modal = document.getElementById('modal-categoria');
    if (modal) modal.classList.remove('hidden');
}

function salvarCategoria() {
    const nome = document.getElementById('cat-nome').value.trim();
    if (!nome) { toast('Informe o nome da categoria.', 'error'); return; }

    const tipo = document.getElementById('cat-tipo').value;
    const key  = tipo === 'despesa' ? 'cat_despesas' : 'cat_receitas';
    const item = {
        id: document.getElementById('cat-edit-id').value || uid(),
        nome,
        icone: document.getElementById('cat-icone').value || '🏠',
        cor: document.getElementById('cat-cor').value || '#3498db'
    };

    const arr    = getData(key, []);
    const editId = document.getElementById('cat-edit-id').value;
    if (editId) {
        const idx = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
    } else {
        arr.push(item);
    }
    localStorage.setItem(key, JSON.stringify(arr));
    toast('Categoria salva!', 'success');
    fecharModal('modal-categoria');
    renderizarDados();
}

function _renderCatDespesas() {
    const lista = document.getElementById('lista-cat-despesas');
    if (!lista) return;
    const cats = getData('cat_despesas');
    if (cats.length === 0) { lista.innerHTML = '<p class="dados-empty">Nenhuma categoria cadastrada ainda.</p>'; return; }
    lista.innerHTML = cats.map(c => `
        <div class="dados-item">
            <div class="dados-item-info">
                <span class="dados-item-nome">${c.icone} ${c.nome}</span>
                <span class="dados-item-sub" style="color:${c.cor}">${c.cor}</span>
            </div>
            <div class="dados-item-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalCategoria('despesa','${c.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirCategoria('despesa','${c.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function _renderCatReceitas() {
    const lista = document.getElementById('lista-cat-receitas');
    if (!lista) return;
    const cats = getData('cat_receitas');
    if (cats.length === 0) { lista.innerHTML = '<p class="dados-empty">Nenhuma categoria cadastrada ainda.</p>'; return; }
    lista.innerHTML = cats.map(c => `
        <div class="dados-item">
            <div class="dados-item-info">
                <span class="dados-item-nome">${c.icone} ${c.nome}</span>
                <span class="dados-item-sub" style="color:${c.cor}">${c.cor}</span>
            </div>
            <div class="dados-item-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalCategoria('receita','${c.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirCategoria('receita','${c.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function excluirCategoria(tipo, id) {
    if (!confirm('Excluir esta categoria?')) return;
    const key = tipo === 'despesa' ? 'cat_despesas' : 'cat_receitas';
    localStorage.setItem(key, JSON.stringify(getData(key).filter(x => x.id !== id)));
    renderizarDados();
    toast('Categoria excluída.', 'success');
}

// ---- TIPOS DE DESPESA ----
function selecionarIconeTipo(el) {
    document.querySelectorAll('#icon-picker-tipo .icon-opt').forEach(i => i.classList.remove('selected'));
    el.classList.add('selected');
    const tipIcEl = document.getElementById('tipo-icone');
    if (tipIcEl) tipIcEl.value = el.dataset.icon;
}

function selecionarCorTipo(el) { _pickerCor('#modal-tipo', 'tipo-cor', el); }

function abrirModalTipo(id = null) {
    const tit = document.getElementById('modal-tipo-titulo');
    if (tit) tit.textContent = id ? 'Editar Tipo' : 'Novo Tipo de Despesa';

    const nomeEl = document.getElementById('tipo-nome');
    if (nomeEl) nomeEl.value = '';
    const editEl = document.getElementById('tipo-edit-id');
    if (editEl) editEl.value = '';

    document.querySelectorAll('#icon-picker-tipo .icon-opt').forEach((el, i) => {
        el.classList.toggle('selected', i === 0);
    });
    const icEl = document.getElementById('tipo-icone');
    if (icEl) icEl.value = '💳';
    _resetPicker('#modal-tipo', 'tipo-cor', '#f39c12');

    if (id) {
        const t = getData('tipos_despesa').find(x => x.id === id);
        if (t) {
            document.getElementById('tipo-edit-id').value = t.id;
            document.getElementById('tipo-nome').value = t.nome;
            if (icEl) icEl.value = t.icone || '💳';
            document.querySelectorAll('#icon-picker-tipo .icon-opt').forEach(el => {
                el.classList.toggle('selected', el.dataset.icon === t.icone);
            });
            _resetPicker('#modal-tipo', 'tipo-cor', t.cor || '#f39c12');
        }
    }
    const modal = document.getElementById('modal-tipo');
    if (modal) modal.classList.remove('hidden');
}

function salvarTipo() {
    const nome = document.getElementById('tipo-nome').value.trim();
    if (!nome) { toast('Informe o nome do tipo.', 'error'); return; }

    const item = {
        id: document.getElementById('tipo-edit-id').value || uid(),
        nome,
        icone: document.getElementById('tipo-icone').value || '💳',
        cor: document.getElementById('tipo-cor').value || '#f39c12'
    };

    const arr    = getData('tipos_despesa', []);
    const editId = document.getElementById('tipo-edit-id').value;
    if (editId) {
        const idx = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
    } else {
        arr.push(item);
    }
    localStorage.setItem('tipos_despesa', JSON.stringify(arr));
    toast('Tipo salvo!', 'success');
    fecharModal('modal-tipo');
    _renderTipos();
}

function _renderTipos() {
    const lista = document.getElementById('lista-tipos-despesa');
    if (!lista) return;
    const tipos = getData('tipos_despesa');
    if (tipos.length === 0) { lista.innerHTML = '<p class="dados-empty">Nenhum tipo cadastrado ainda.</p>'; return; }
    lista.innerHTML = tipos.map(t => `
        <div class="dados-item">
            <div class="dados-item-info">
                <span class="dados-item-nome">${t.icone} ${t.nome}</span>
                <span class="dados-item-sub" style="color:${t.cor}">${t.cor}</span>
            </div>
            <div class="dados-item-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalTipo('${t.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirTipo('${t.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join('');
}

function excluirTipo(id) {
    if (!confirm('Excluir este tipo?')) return;
    localStorage.setItem('tipos_despesa', JSON.stringify(getData('tipos_despesa').filter(x => x.id !== id)));
    _renderTipos();
    toast('Tipo excluído.', 'success');
}

// ---- METAS ----
function abrirModalMeta(id = null) {
    const tit = document.getElementById('modal-meta-titulo');
    if (tit) tit.textContent = id ? 'Editar Meta' : 'Nova Meta';

    const editEl = document.getElementById('meta-edit-id');
    if (editEl) editEl.value = '';
    const valEl = document.getElementById('meta-valor');
    if (valEl) valEl.value = '';
    const obsEl = document.getElementById('meta-obs');
    if (obsEl) obsEl.value = '';

    const catSel = document.getElementById('meta-categoria');
    if (catSel) {
        const cats = getData('cat_despesas');
        catSel.innerHTML = '<option value="">Selecione uma categoria de despesa...</option>' +
            cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
    }

    if (id) {
        const m = getData('metas').find(x => x.id === id);
        if (m) {
            document.getElementById('meta-edit-id').value = m.id;
            document.getElementById('meta-categoria').value = m.categoriaId || '';
            document.getElementById('meta-valor').value = m.valor || '';
            document.getElementById('meta-obs').value = m.obs || '';
        }
    }
    const modal = document.getElementById('modal-meta');
    if (modal) modal.classList.remove('hidden');
}

function salvarMeta() {
    const catId = document.getElementById('meta-categoria').value;
    const valor = parseFloat(document.getElementById('meta-valor').value);
    if (!catId) { toast('Selecione uma categoria.', 'error'); return; }
    if (!valor) { toast('Informe o valor limite.', 'error'); return; }

    const item = {
        id: document.getElementById('meta-edit-id').value || uid(),
        categoriaId: catId,
        valor,
        obs: document.getElementById('meta-obs').value
    };

    const arr    = getData('metas', []);
    const editId = document.getElementById('meta-edit-id').value;
    if (editId) {
        const idx = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
    } else {
        arr.push(item);
    }
    localStorage.setItem('metas', JSON.stringify(arr));
    toast('Meta salva!', 'success');
    fecharModal('modal-meta');
    _renderMetas();
}

function _renderMetas() {
    const lista    = document.getElementById('lista-metas');
    const totalEl  = document.getElementById('metas-total-valor');
    if (!lista) return;

    const metas    = getData('metas');
    const cats     = getData('cat_despesas');
    const despMes  = _filtrarPorMes(getData('despesas_gastos'), 'data');

    const total = metas.reduce((s, m) => s + (parseFloat(m.valor) || 0), 0);
    if (totalEl) totalEl.textContent = brl(total);

    if (metas.length === 0) {
        lista.innerHTML = '<p class="dados-empty">Nenhuma meta cadastrada ainda.</p>';
        return;
    }

    lista.innerHTML = metas.map(m => {
        const cat     = cats.find(c => c.id === m.categoriaId);
        const gasto   = despMes.filter(d => d.categoriaId === m.categoriaId).reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const pct     = Math.min(100, m.valor > 0 ? Math.round((gasto / m.valor) * 100) : 0);
        const cor     = pct >= 100 ? '#e74c3c' : pct >= 80 ? '#f39c12' : '#2ecc71';
        return `
        <div class="dados-item">
            <div class="dados-item-info" style="flex:1">
                <span class="dados-item-nome">${cat ? cat.icone + ' ' + cat.nome : 'Categoria removida'}</span>
                <span class="dados-item-sub">Limite: ${brl(m.valor)} · Gasto: ${brl(gasto)} (${pct}%)</span>
                <div style="background:#e0e0e0;border-radius:4px;height:5px;margin-top:4px">
                    <div style="background:${cor};width:${pct}%;height:5px;border-radius:4px;transition:width .5s"></div>
                </div>
            </div>
            <div class="dados-item-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalMeta('${m.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirMeta('${m.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

function excluirMeta(id) {
    if (!confirm('Excluir esta meta?')) return;
    localStorage.setItem('metas', JSON.stringify(getData('metas').filter(x => x.id !== id)));
    _renderMetas();
    toast('Meta excluída.', 'success');
}

// ==========================================
// RENDERIZAR ANÁLISE (Dashboard)
// ==========================================
let _chartPizza = null;

function renderizarAnalise() {
    const despesas = _filtrarPorMes(getData('despesas_gastos'), 'data');
    const apagar   = _filtrarPorMes(getData('a_pagar'), 'vencimento');
    const cartoes  = getData('cartoes');
    const cats     = getData('cat_despesas');

    // --- KPIs ---
    const despCartao = despesas.filter(d => d.tipoPagamentoVal && d.tipoPagamentoVal.startsWith('cartao_'));
    const totalCartao = despCartao.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    const contasPagas = apagar.filter(i => i.pago);
    const totalPagas  = contasPagas.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);

    const pendentes   = apagar.filter(i => !i.pago);
    const totalPend   = pendentes.reduce((s, i) => s + (parseFloat(i.valor) || 0), 0);

    const totalDesp   = despesas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    _set('kpi-cartoes',    brl(totalCartao));
    _set('kpi-cartoes-sub', despCartao.length + ' transações');
    _set('kpi-pagas',      brl(totalPagas));
    _set('kpi-pagas-sub',  contasPagas.length + ' contas');
    _set('kpi-previsao',   brl(totalPend));
    _set('kpi-total-despesas', brl(totalDesp));

    // --- Gráfico pizza ---
    _renderPizza(despesas, cats);

    // --- Top 10 ---
    _renderTop10(despesas);

    // --- Detalhamento cartões ---
    _renderDetalhamentoCartoes(despesas, cartoes);

    // --- Contas pagas / pendentes / vencidas ---
    _renderContasStatus(apagar);

    // Atualizar notificações
    atualizarIconeNotificacao();
}

function _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
}

function _renderPizza(despesas, cats) {
    const canvas    = document.getElementById('chart-pizza');
    const emptyEl   = document.getElementById('pizza-empty');
    const legendEl  = document.getElementById('pizza-legend');
    const container = document.getElementById('pizza-container');

    if (!despesas.length) {
        if (container) container.classList.add('hidden');
        if (emptyEl)   emptyEl.classList.remove('hidden');
        if (_chartPizza) { _chartPizza.destroy(); _chartPizza = null; }
        return;
    }
    if (container) container.classList.remove('hidden');
    if (emptyEl)   emptyEl.classList.add('hidden');

    const porCat = {};
    despesas.forEach(d => {
        const catId = d.categoriaId || '__sem__';
        porCat[catId] = (porCat[catId] || 0) + (parseFloat(d.valor) || 0);
    });

    const labels = [], data = [], cores = [];
    Object.entries(porCat).sort((a,b) => b[1]-a[1]).forEach(([id, val]) => {
        const cat = cats.find(c => c.id === id);
        labels.push(cat ? `${cat.icone} ${cat.nome}` : 'Sem categoria');
        data.push(val);
        cores.push(cat ? cat.cor : '#bdc3c7');
    });

    if (_chartPizza) _chartPizza.destroy();
    if (!canvas) return;

    _chartPizza = new Chart(canvas, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: cores, borderWidth: 2, borderColor: '#fff' }] },
        options: {
            responsive: false,
            plugins: {
                legend: { display: false },
                tooltip: { callbacks: { label: ctx => ` ${brl(ctx.parsed)}` } }
            }
        }
    });

    if (legendEl) {
        const total = data.reduce((s,v) => s+v, 0);
        legendEl.innerHTML = labels.map((l, i) => `
            <div class="pizza-legend-item">
                <span class="pizza-legend-dot" style="background:${cores[i]}"></span>
                <span class="pizza-legend-nome">${l}</span>
                <span class="pizza-legend-val">${brl(data[i])}</span>
                <span class="pizza-legend-pct">${total > 0 ? Math.round(data[i]/total*100) : 0}%</span>
            </div>`).join('');
    }
}

function _renderTop10(despesas) {
    const el = document.getElementById('top10-lista');
    if (!el) return;
    const semCartao = despesas.filter(d => !(d.tipoPagamentoVal && d.tipoPagamentoVal.startsWith('cartao_')));
    const top10 = [...semCartao].sort((a, b) => (parseFloat(b.valor)||0) - (parseFloat(a.valor)||0)).slice(0, 10);
    if (!top10.length) {
        el.innerHTML = '<div class="dash-empty"><i class="fas fa-receipt"></i><p>Sem despesas no período</p></div>';
        return;
    }
    const maxVal = parseFloat(top10[0].valor) || 1;
    el.innerHTML = top10.map((d, i) => {
        const pct = Math.round((parseFloat(d.valor) / maxVal) * 100);
        return `
        <div style="margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px">
                <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:65%">${i+1}. ${d.descricao}</span>
                <span style="color:#e74c3c;font-weight:700" class="valor-dinheiro">${brl(d.valor)}</span>
            </div>
            <div style="background:#e0e0e0;border-radius:4px;height:5px">
                <div style="background:#e74c3c;width:${pct}%;height:5px;border-radius:4px"></div>
            </div>
        </div>`;
    }).join('');
}

function _renderDetalhamentoCartoes(despesas, cartoes) {
    const el = document.getElementById('dash-cartoes-detalhe');
    if (!el) return;
    if (!cartoes.length) {
        el.innerHTML = '<div class="dash-empty"><i class="fas fa-credit-card"></i><p>Nenhum cartão cadastrado</p></div>';
        return;
    }
    el.innerHTML = cartoes.map(c => {
        const desp  = despesas.filter(d => d.tipoPagamentoVal === 'cartao_' + c.id);
        const total = desp.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);
        const pct   = c.limite > 0 ? Math.min(100, Math.round(total / c.limite * 100)) : 0;
        const cor   = pct >= 90 ? '#e74c3c' : pct >= 70 ? '#f39c12' : c.cor || '#3498db';
        return `
        <div class="dash-cartao-item">
            <div class="dash-cartao-chip" style="background:${c.cor||'#3498db'}">💳</div>
            <div class="dash-cartao-info">
                <span class="dash-cartao-nome">${c.nome}</span>
                <span class="dash-cartao-sub">${c.bandeira || ''} ${c.digitos ? '····'+c.digitos : ''}</span>
                ${c.limite > 0 ? `
                <div class="dash-cartao-bar-wrap">
                    <div class="dash-cartao-bar" style="background:${cor};width:${pct}%"></div>
                </div>
                <span class="dash-cartao-limite">Limite: ${brl(c.limite)} · Usado: ${pct}%</span>` : ''}
            </div>
            <div class="dash-cartao-total">
                <span class="dash-cartao-valor valor-dinheiro">${brl(total)}</span>
                <span class="dash-cartao-qtd">${desp.length} transações</span>
            </div>
        </div>`;
    }).join('');
}

function _renderContasStatus(apagar) {
    const pagas    = apagar.filter(i => _statusAPagar(i) === 'pago');
    const pend     = apagar.filter(i => _statusAPagar(i) === 'pendente');
    const venc     = apagar.filter(i => _statusAPagar(i) === 'vencido');

    const _lista = (id, items, emptyIcon) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = items.length === 0
            ? `<div class="dash-empty" style="padding:16px"><i class="fas fa-${emptyIcon}"></i><p>Nenhuma</p></div>`
            : items.map(i => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
                    <div>
                        <div style="font-weight:600">${i.descricao}</div>
                        <div style="color:#999;font-size:11px">Venc: ${_fmtData(i.vencimento)}</div>
                    </div>
                    <span style="font-weight:700;color:#e74c3c" class="contas-val">${brl(i.valor)}</span>
                </div>`).join('');
    };

    _lista('contas-pagas-lista',     pagas, 'check-circle');
    _lista('contas-pendentes-lista', pend,  'clock');
    _lista('contas-vencidas-lista',  venc,  'exclamation-triangle');
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    renderizarConfiguracoes();
    atualizarIconeNotificacao();
});
