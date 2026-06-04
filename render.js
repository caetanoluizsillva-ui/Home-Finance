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

// ──────────────────────────────────────────
// LÓGICA DE PARCELAS E A PAGAR
//
// Um item pode ser:
//   tipo === 'Parcelado'  →  gera N entradas virtuais (1 por mês)
//   tipo !== 'Parcelado'  →  entrada única
//
// Regras de exibição em A PAGAR:
//   • Itens não pagos (pendente/vencido) aparecem em seu mês de vencimento
//   • Itens vencidos e não pagos aparecem em TODOS os meses futuros e no mês atual também
//   • Itens pagos NÃO aparecem mais em A Pagar (foram para Despesas)
//   • Para parcelados: cada parcela paga some de A Pagar; as futuras ainda aparecem
//
// Ao marcar pago:
//   • Cria automaticamente uma despesa com a data de hoje
//   • Remove o item de A Pagar (ou marca a parcela como paga)
// ──────────────────────────────────────────

/**
 * Expande itens de a_pagar em entradas virtuais por parcela.
 * Retorna array de objetos com campos extras:
 *   _parcelaNum, _parcelaNome, _valorParcela, _instanciaId (único por parcela)
 */
function _expandirAPagar(lista) {
    const result = [];
    lista.forEach(item => {
        if (item.tipo === 'Parcelado' && item.parcelas > 1) {
            const total = item.parcelas;
            const valorParcela = parseFloat(item.valor) / total;
            // Parcelas já pagas são armazenadas em item.parcelasPagas = [1,2,...]
            const pagas = item.parcelasPagas || (item.pago ? Array.from({length: total}, (_, i) => i + 1) : []);
            for (let p = 1; p <= total; p++) {
                // Calcular vencimento desta parcela (mês + p-1)
                const [y, m, d] = (item.vencimento || '').split('-').map(Number);
                const vencDate = new Date(y, m - 1 + (p - 1), d);
                const vencISO = vencDate.toISOString().slice(0, 10);
                const estaPaga = pagas.includes(p);
                result.push({
                    ...item,
                    _parcelaNum: p,
                    _parcelaNome: `${item.descricao} (${p}/${total})`,
                    _valorParcela: valorParcela,
                    _instanciaId: `${item.id}_p${p}`,
                    vencimento: vencISO,
                    pago: estaPaga,
                    _parcelasPagas: pagas,
                    _totalParcelas: total,
                    _isParcelado: true,
                });
            }
        } else {
            result.push({ ...item, _isParcelado: false, _valorParcela: parseFloat(item.valor) || 0 });
        }
    });
    return result;
}

/**
 * Filtra entradas virtuais de A PAGAR para exibição no mês selecionado.
 * Regras:
 *   - Itens pagos → NÃO aparecem (foram para despesas)
 *   - Itens pendentes/vencidos → aparecem APENAS no seu mês de vencimento
 *   - Itens VENCIDOS (data passada, não pagos) → aparecem no mês atual também
 */
function _filtrarAPagarParaMes(lista) {
    const mes = getMesSel();
    const ano = getAnoSel();
    const expandida = _expandirAPagar(lista);
    if (mes === null) {
        // Modo "todos": mostra só os não pagos
        return expandida.filter(i => !i.pago);
    }

    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const inicioMes = new Date(ano, mes, 1);
    const fimMes    = new Date(ano, mes + 1, 0);

    return expandida.filter(item => {
        if (item.pago) return false; // pagos somem de A Pagar

        const venc = new Date((item.vencimento || '') + 'T00:00:00');
        const esteEhOMesDeVenc = venc.getMonth() === mes && venc.getFullYear() === ano;

        // Se o item está vencido (data antes de hoje) e ainda não foi pago,
        // aparece no mês atual e em todos meses futuros ao vencimento
        const estaVencido = venc < hoje;
        const mesAtual    = hoje.getMonth() === mes && hoje.getFullYear() === ano;
        const mesFuturo   = inicioMes > hoje;

        if (esteEhOMesDeVenc) return true;
        if (estaVencido && (mesAtual || mesFuturo)) return true;
        return false;
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

// ==========================================
// PREVISÃO — placeholder (funções futuras)
// ==========================================
function renderizarPrevisao() {
    // Página reservada para funcionalidades futuras.
    // Nenhuma renderização necessária por enquanto.
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

    // Usa parcelas expandidas para notificações próximas/vencidas
    const expandidas = _expandirAPagar(getData('a_pagar', []));
    const notifs = [];

    expandidas.forEach(item => {
        if (item.pago) return;
        const status = _statusAPagar(item);
        const nome  = item._isParcelado ? item._parcelaNome : item.descricao;
        const valor = item._valorParcela || parseFloat(item.valor) || 0;
        // Para notificações, o id de navegação é sempre o item pai
        const navId = item.id;
        if (status === 'vencido') {
            notifs.push({ tipo: 'vencido', id: navId, msg: `<strong>${nome}</strong> venceu em ${_fmtData(item.vencimento)} (${brl(valor)})` });
        } else if (status === 'pendente') {
            const venc = new Date(item.vencimento + 'T00:00:00');
            if (venc <= em3) {
                notifs.push({ tipo: 'proximo', id: navId, msg: `<strong>${nome}</strong> vence em ${_fmtData(item.vencimento)} (${brl(valor)})` });
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
                <div class="notif-item notif-item--${n.tipo}" style="cursor:pointer;" onclick="irParaItemAPagar('${n.id}')">
                    <i class="fas fa-${n.tipo === 'vencido' ? 'exclamation-triangle' : 'clock'}"></i>
                    <span>${n.msg}</span>
                    <i class="fas fa-arrow-right" style="margin-left:auto;font-size:10px;opacity:0.5;flex-shrink:0;"></i>
                </div>`).join('');
        }
    }
}

function irParaItemAPagar(itemId) {
    const panel = document.getElementById('notif-panel');
    if (panel) panel.classList.add('hidden');
    const menuItem = document.querySelector('.menu-item[onclick*="a-pagar"]');
    if (menuItem) mudarAba('A Pagar', 'a-pagar', menuItem);
    setTimeout(() => {
        const itemEl = document.querySelector(`[data-id="${itemId}"]`);
        if (itemEl) {
            itemEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            itemEl.classList.add('notif-highlight');
            setTimeout(() => itemEl.classList.remove('notif-highlight'), 2500);
        }
    }, 300);
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

    // Usa nova lógica: expande parcelas, filtra por mês com regras de vencido
    let items = _filtrarAPagarParaMes(getData('a_pagar'));
    const statusFiltro = filtroS ? filtroS.value : '';
    const catFiltro    = filtroC ? filtroC.value : '';
    if (statusFiltro) items = items.filter(i => _statusAPagar(i) === statusFiltro);
    if (catFiltro)    items = items.filter(i => i.categoriaId === catFiltro);

    items.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));

    const total = items.reduce((s, i) => s + (i._valorParcela || parseFloat(i.valor) || 0), 0);
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
        const badgeClass = { pendente: 'badge-pendente', vencido: 'badge-vencido' }[status] || 'badge-pendente';
        const badgeLabel = { pendente: 'Pendente', vencido: 'Vencido' }[status] || 'Pendente';
        const valorExibir = item._isParcelado ? item._valorParcela : (parseFloat(item.valor) || 0);
        const nomeExibir  = item._isParcelado ? item._parcelaNome : item.descricao;
        // Para parcelados usa _instanciaId para o botão pagar; para normais usa item.id
        const pagarId = item._isParcelado ? item._instanciaId : item.id;
        return `
        <div class="reg-item" data-id="${item.id}">
            <div class="reg-icon" style="background:${cor}22; color:${cor}">${icone}</div>
            <div class="reg-info">
                <span class="reg-nome">${nomeExibir}</span>
                <span class="reg-sub">Venc: ${_fmtData(item.vencimento)}${item.tipoPagamentoNome ? ' · ' + item.tipoPagamentoNome : ''}${status === 'vencido' ? ' · <span style="color:#e74c3c;font-weight:600">Vencido</span>' : ''}</span>
            </div>
            <div class="reg-meio">
                <span class="badge ${badgeClass}">${badgeLabel}</span>
                <span class="reg-tipo-tag">${item.tipo || ''}</span>
            </div>
            <span class="reg-valor text-danger">${brl(valorExibir)}</span>
            <div class="reg-actions">
                <button class="btn-icon btn-edit" title="Marcar pago" onclick="marcarPago('${pagarId}')"><i class="fas fa-check"></i></button>
                ${!item._isParcelado ? `<button class="btn-icon btn-edit" onclick="abrirModalAPagar('${item.id}')"><i class="fas fa-pen"></i></button>` : ''}
                <button class="btn-icon btn-del" onclick="excluirAPagar('${item.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

/**
 * Marca um item (ou parcela) como pago e cria despesa correspondente.
 * id pode ser:
 *   - "abc123"       → item simples
 *   - "abc123_p2"    → parcela 2 do item abc123
 */
function marcarPago(instanciaId) {
    const arr = getData('a_pagar');
    const hoje = new Date().toISOString().slice(0, 10);

    // Detecta se é parcela
    const parcelaMatch = instanciaId.match(/^(.+)_p(\d+)$/);
    let itemOriginal, valorPago, descPago, nParc;

    if (parcelaMatch) {
        // Parcela específica
        const itemId = parcelaMatch[1];
        nParc = parseInt(parcelaMatch[2]);
        const idx = arr.findIndex(x => x.id === itemId);
        if (idx === -1) return;
        itemOriginal = arr[idx];
        valorPago = parseFloat(itemOriginal.valor) / (itemOriginal.parcelas || 1);
        descPago  = `${itemOriginal.descricao} (${nParc}/${itemOriginal.parcelas})`;

        // Adiciona esta parcela à lista de pagas
        const pagas = itemOriginal.parcelasPagas || [];
        if (!pagas.includes(nParc)) pagas.push(nParc);
        arr[idx].parcelasPagas = pagas;

        // Se todas as parcelas foram pagas, marca o item como pago
        if (pagas.length >= (itemOriginal.parcelas || 1)) {
            arr[idx].pago = true;
        }
    } else {
        // Item simples
        const idx = arr.findIndex(x => x.id === instanciaId);
        if (idx === -1) return;
        itemOriginal = arr[idx];
        valorPago = parseFloat(itemOriginal.valor) || 0;
        descPago  = itemOriginal.descricao;
        arr[idx].pago = true;
        arr[idx].dataPagamento = hoje;
    }

    localStorage.setItem('a_pagar', JSON.stringify(arr));

    // Cria despesa com a data de hoje
    const despesas = getData('despesas_gastos');
    despesas.push({
        id: uid(),
        descricao: descPago,
        valor: valorPago,
        data: hoje,
        categoriaId: itemOriginal.categoriaId,
        tipoPagamentoVal: itemOriginal.tipoPagamentoVal,
        tipoPagamentoNome: itemOriginal.tipoPagamentoNome,
        obs: itemOriginal.obs || '',
        _origemAPagar: itemOriginal.id,
    });
    localStorage.setItem('despesas_gastos', JSON.stringify(despesas));

    renderizarAPagar();
    renderizarDespesas();
    renderizarAnalise();
    atualizarIconeNotificacao();
    toast('Conta paga! Lançada em Despesas.', 'success');
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

    const mes = getMesSel();
    const ano = getAnoSel();
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const todasReceitas = getData('receitas');

    // Recebidas: só aparecem no mês em que foram recebidas (filtragem normal por data)
    // Previstas não recebidas: aparecem no mês previsto; se passado, aparecem também no mês atual
    let receitas;
    if (mes === null) {
        receitas = todasReceitas;
    } else {
        const inicioMes = new Date(ano, mes, 1);
        receitas = todasReceitas.filter(r => {
            const d = new Date((r.data || '') + 'T00:00:00');
            const eMesData = d.getMonth() === mes && d.getFullYear() === ano;
            if (r.status === 'recebido') return eMesData; // recebida: só no mês da data
            // Prevista: aparece no mês, ou se data passou e ainda não recebida, aparece no mês atual
            if (eMesData) return true;
            const estaAtrasada = d < hoje;
            const mesAtual = hoje.getMonth() === mes && hoje.getFullYear() === ano;
            const mesFut   = inicioMes > hoje;
            return estaAtrasada && (mesAtual || mesFut);
        });
    }

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
// CARTÕES DE CRÉDITO — Página dedicada
// ==========================================
// Chave de storage: 'gastos_cartao'
// Cada item: { id, cartaoId, descricao, valor, data, parcelas, categoriaId, local, obs }
// Regra de negócio:
//   Ao salvar/editar gastos, recalcula automaticamente a conta a pagar do cartão
//   no mês de vencimento. A conta a pagar armazena o TOTAL da fatura (não os itens).
//   ID da conta a pagar: 'fatura_<cartaoId>_<AAAA>_<MM>'

// Estado interno da aba Cartões
let _ccCartaoSel = null;  // id do cartão selecionado
let _ccMesSel    = null;  // mês da fatura (0-11 ou null = mês atual)
let _ccAnoSel    = null;

// ── Helpers de fatura ─────────────────────────────────────────────────────────

/**
 * Retorna o mês/ano de vencimento de uma compra num cartão.
 * Regra: se a data da compra for ATÉ o dia de vencimento do cartão no mês,
 * a fatura fecha naquele mês. Se for DEPOIS, cai na fatura do mês seguinte.
 */
function _ccMesFatura(dataCompraISO, cartao) {
    const [y, m, d] = dataCompraISO.split('-').map(Number);
    const diaVenc = parseInt(cartao.vencimento) || 1;
    // Se compra for após o dia de vencimento, cai no mês seguinte
    let mesF = m - 1; // 0-based
    let anoF = y;
    if (d > diaVenc) {
        mesF++;
        if (mesF > 11) { mesF = 0; anoF++; }
    }
    return { mes: mesF, ano: anoF };
}

/**
 * Retorna a data ISO de vencimento da fatura para um dado mês/ano e cartão.
 */
function _ccDataVencFatura(mes, ano, cartao) {
    const dia = parseInt(cartao.vencimento) || 1;
    // Garante dia válido no mês (ex: dia 31 em fevereiro)
    const dataObj = new Date(ano, mes, dia);
    // Se dia inválido, JS avança para o próximo mês; usamos o último dia do mês
    const diaReal = dataObj.getDate() === dia ? dia :
        new Date(ano, mes + 1, 0).getDate();
    return `${ano}-${String(mes + 1).padStart(2,'0')}-${String(diaReal).padStart(2,'0')}`;
}

/**
 * Calcula o total da fatura de um cartão num dado mês/ano.
 */
function _ccTotalFatura(cartaoId, mes, ano) {
    const gastos = getData('gastos_cartao');
    const cartao = getData('cartoes').find(c => c.id === cartaoId);
    if (!cartao) return 0;
    return gastos
        .filter(g => g.cartaoId === cartaoId)
        .reduce((soma, g) => {
            // Cada parcela cai no seu mês de fatura
            const nParc = parseInt(g.parcelas) || 1;
            const valorParcela = (parseFloat(g.valor) || 0) / nParc;
            for (let p = 0; p < nParc; p++) {
                // Calcula a data de referência para esta parcela (mês + p)
                const [y, m, d] = g.data.split('-').map(Number);
                const dataParc = new Date(y, m - 1 + p, d);
                const dataISO  = dataParc.toISOString().slice(0, 10);
                const { mes: mF, ano: aF } = _ccMesFatura(dataISO, cartao);
                if (mF === mes && aF === ano) soma += valorParcela;
            }
            return soma;
        }, 0);
}

/**
 * Recalcula e upsert a conta a pagar da fatura de um cartão no mês/ano.
 * Chama isso sempre que um gasto é salvo ou excluído.
 */
function _ccSincronizarAPagar(cartaoId, mes, ano) {
    const cartao = getData('cartoes').find(c => c.id === cartaoId);
    if (!cartao) return;

    const total      = _ccTotalFatura(cartaoId, mes, ano);
    const faturaId   = `fatura_${cartaoId}_${ano}_${String(mes + 1).padStart(2,'0')}`;
    const vencimento = _ccDataVencFatura(mes, ano, cartao);
    const arr        = getData('a_pagar');
    const idx        = arr.findIndex(x => x.id === faturaId);

    if (total <= 0) {
        // Sem gastos nesse mês: remove a conta a pagar se existir e não estiver paga
        if (idx > -1 && !arr[idx].pago) {
            arr.splice(idx, 1);
            localStorage.setItem('a_pagar', JSON.stringify(arr));
        }
        return;
    }

    const contaFatura = {
        id: faturaId,
        descricao: `Fatura ${cartao.nome} — ${MESES_ABREV[mes]}/${String(ano).slice(2)}`,
        valor: Math.round(total * 100) / 100,
        vencimento,
        categoriaId: '',
        tipoPagamentoVal: `cartao_${cartaoId}`,
        tipoPagamentoNome: cartao.nome,
        tipo: 'Único',
        parcelas: null,
        obs: `Gerado automaticamente a partir dos gastos do cartão`,
        pago: idx > -1 ? arr[idx].pago : false,     // preserva status pago
        dataPagamento: idx > -1 ? arr[idx].dataPagamento : null,
        _faturaCartao: true,
        _cartaoId: cartaoId
    };

    if (idx > -1) {
        // Só atualiza valor/vencimento se ainda não estiver pago
        if (!arr[idx].pago) arr[idx] = contaFatura;
    } else {
        arr.push(contaFatura);
    }
    localStorage.setItem('a_pagar', JSON.stringify(arr));
}

/**
 * Recalcula TODAS as faturas de um cartão (varre todos os gastos).
 */
function _ccRecalcularTodoCartao(cartaoId) {
    const cartao = getData('cartoes').find(c => c.id === cartaoId);
    if (!cartao) return;
    const gastos = getData('gastos_cartao').filter(g => g.cartaoId === cartaoId);
    const mesesAfetados = new Set();
    gastos.forEach(g => {
        const nParc = parseInt(g.parcelas) || 1;
        for (let p = 0; p < nParc; p++) {
            const [y, m, d] = g.data.split('-').map(Number);
            const dataParc = new Date(y, m - 1 + p, d);
            const { mes, ano } = _ccMesFatura(dataParc.toISOString().slice(0, 10), cartao);
            mesesAfetados.add(`${ano}_${mes}`);
        }
    });
    mesesAfetados.forEach(chave => {
        const [ano, mes] = chave.split('_').map(Number);
        _ccSincronizarAPagar(cartaoId, mes, ano);
    });
}

// ── Renderização da grade de cartões ─────────────────────────────────────────

function renderizarCartoes() {
    const cartoes = getData('cartoes');
    const grade   = document.getElementById('cartoes-grade');
    const painel  = document.getElementById('cc-painel');
    if (!grade) return;

    // Inicializa mês/ano se ainda não definido
    if (_ccMesSel === null) {
        _ccMesSel = new Date().getMonth();
        _ccAnoSel = new Date().getFullYear();
    }

    if (cartoes.length === 0) {
        grade.innerHTML = `
        <div class="cc-empty">
            <i class="fas fa-credit-card"></i>
            <p>Nenhum cartão cadastrado.</p>
            <small>Adicione cartões na aba <strong>Dados</strong> para começar.</small>
        </div>`;
        if (painel) painel.classList.add('hidden');
        return;
    }

    grade.innerHTML = cartoes.map(c => {
        const totalMes = _ccTotalFatura(c.id, _ccMesSel, _ccAnoSel);
        const pct      = c.limite > 0 ? Math.min(100, Math.round(totalMes / c.limite * 100)) : 0;
        const corBar   = pct >= 90 ? '#e74c3c' : pct >= 70 ? '#f39c12' : '#2ecc71';
        const isAtivo  = _ccCartaoSel === c.id;
        return `
        <div class="cc-card ${isAtivo ? 'cc-card--ativo' : ''}"
             style="--cc-cor:${c.cor||'#3498db'}"
             onclick="ccSelecionarCartao('${c.id}')">
            <div class="cc-card-topo">
                <div class="cc-card-bandeira">${_ccIconeBandeira(c.bandeira)}</div>
                <span class="cc-card-nome">${c.nome}</span>
            </div>
            <div class="cc-card-numero">${c.digitos ? '•••• •••• •••• ' + c.digitos : '•••• •••• •••• ••••'}</div>
            <div class="cc-card-rodape">
                <div>
                    <div class="cc-card-label">Fatura ${MESES_ABREV[_ccMesSel]}/${String(_ccAnoSel).slice(2)}</div>
                    <div class="cc-card-fatura valor-dinheiro">${brl(totalMes)}</div>
                </div>
                ${c.limite > 0 ? `<div style="text-align:right">
                    <div class="cc-card-label">Limite</div>
                    <div class="cc-card-fatura">${brl(c.limite)}</div>
                </div>` : ''}
            </div>
            ${c.limite > 0 ? `<div class="cc-card-bar-wrap">
                <div class="cc-card-bar-fill" style="width:${pct}%;background:${corBar}"></div>
            </div>` : ''}
        </div>`;
    }).join('');

    // Se havia um cartão selecionado, re-renderiza o painel
    if (_ccCartaoSel) {
        _ccRenderizarPainel(_ccCartaoSel);
    } else if (painel) {
        painel.classList.add('hidden');
    }

    _ccAtualizarMesLabel();
}

function _ccIconeBandeira(bandeira) {
    const map = { Visa:'VISA', Mastercard:'MC', Elo:'ELO', Amex:'AMEX', Hipercard:'HIPER', Outra:'💳' };
    return map[bandeira] || '💳';
}

function ccSelecionarCartao(id) {
    _ccCartaoSel = id;
    renderizarCartoes(); // recarrega grade com destaque
}

// ── Painel de detalhes ────────────────────────────────────────────────────────

function _ccRenderizarPainel(cartaoId) {
    const cartao = getData('cartoes').find(c => c.id === cartaoId);
    const painel = document.getElementById('cc-painel');
    if (!cartao || !painel) return;

    painel.classList.remove('hidden');

    // Chip e info
    const chip = document.getElementById('cc-painel-chip');
    if (chip) { chip.textContent = '💳'; chip.style.background = cartao.cor || '#3498db'; }
    _set('cc-painel-nome', cartao.nome);
    _set('cc-painel-info', `${cartao.bandeira || ''}${cartao.digitos ? ' •••• ' + cartao.digitos : ''}${cartao.vencimento ? ' · Vence dia ' + cartao.vencimento : ''}`);

    // Totais
    const total    = _ccTotalFatura(cartaoId, _ccMesSel, _ccAnoSel);
    const dispBrl  = cartao.limite > 0 ? brl(cartao.limite - total) : '—';
    const vencLabel = cartao.vencimento
        ? `Dia ${cartao.vencimento} de ${MESES_ABREV[_ccMesSel]}/${String(_ccAnoSel).slice(2)}`
        : 'Não definido';

    _set('cc-fatura-valor', brl(total));
    _set('cc-limite-disp', dispBrl);
    _set('cc-venc-label', vencLabel);

    // Barra de limite
    const barWrap = document.getElementById('cc-limite-bar-wrap');
    const barFill = document.getElementById('cc-limite-bar-fill');
    const barLabel = document.getElementById('cc-limite-bar-label');
    if (cartao.limite > 0) {
        const pct  = Math.min(100, Math.round(total / cartao.limite * 100));
        const cor  = pct >= 90 ? '#e74c3c' : pct >= 70 ? '#f39c12' : '#2ecc71';
        if (barWrap)  barWrap.style.display = '';
        if (barFill)  { barFill.style.width = pct + '%'; barFill.style.background = cor; }
        if (barLabel) barLabel.textContent  = `${pct}% do limite utilizado (${brl(total)} de ${brl(cartao.limite)})`;
    } else {
        if (barWrap) barWrap.style.display = 'none';
    }

    _ccAtualizarMesLabel();
    _ccRenderizarGastos(cartaoId);
}

function _ccAtualizarMesLabel() {
    const el = document.getElementById('cc-mes-label');
    if (el) el.textContent = MESES_ABREV[_ccMesSel] + ' ' + _ccAnoSel;
}

// ── Lista de gastos do cartão no mês ─────────────────────────────────────────

function _ccRenderizarGastos(cartaoId) {
    const lista    = document.getElementById('cc-lista-gastos');
    const totalEl  = document.getElementById('cc-gastos-total');
    const cats     = getData('cat_despesas');
    const cartao   = getData('cartoes').find(c => c.id === cartaoId);
    if (!lista || !cartao) return;

    // Busca gastos cujas PARCELAS caem neste mês/ano
    const gastosBrutos = getData('gastos_cartao').filter(g => g.cartaoId === cartaoId);
    const gastosNaMes  = [];

    gastosBrutos.forEach(g => {
        const nParc = parseInt(g.parcelas) || 1;
        for (let p = 0; p < nParc; p++) {
            const [y, m, d] = g.data.split('-').map(Number);
            const dataParc  = new Date(y, m - 1 + p, d);
            const dataISO   = dataParc.toISOString().slice(0, 10);
            const { mes, ano } = _ccMesFatura(dataISO, cartao);
            if (mes === _ccMesSel && ano === _ccAnoSel) {
                const valorParcela = (parseFloat(g.valor) || 0) / nParc;
                gastosNaMes.push({ ...g, _parcela: p + 1, _totalParc: nParc, _valorParcela: valorParcela });
            }
        }
    });

    gastosNaMes.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const total = gastosNaMes.reduce((s, g) => s + g._valorParcela, 0);
    if (totalEl) totalEl.textContent = brl(total);

    if (gastosNaMes.length === 0) {
        lista.innerHTML = '<div class="registros-empty"><i class="fas fa-receipt"></i><p>Nenhum gasto nesta fatura.</p></div>';
        return;
    }

    lista.innerHTML = gastosNaMes.map(g => {
        const cat   = cats.find(c => c.id === g.categoriaId);
        const icone = cat ? cat.icone : '🛍️';
        const cor   = cat ? cat.cor   : '#95a5a6';
        const parcelaLabel = g._totalParc > 1
            ? `<span class="reg-tipo-tag">${g._parcela}/${g._totalParc}</span>` : '';
        const sub = [_fmtData(g.data), g.local].filter(Boolean).join(' · ');
        return `
        <div class="reg-item">
            <div class="reg-icon" style="background:${cor}22;color:${cor}">${icone}</div>
            <div class="reg-info">
                <span class="reg-nome">${g.descricao}</span>
                <span class="reg-sub">${sub}</span>
            </div>
            <div class="reg-meio">
                ${cat ? `<span class="reg-tipo-tag">${cat.nome}</span>` : ''}
                ${parcelaLabel}
            </div>
            <span class="reg-valor text-danger valor-dinheiro">${brl(g._valorParcela)}${g._totalParc > 1 ? `<small style="font-size:10px;color:#999;display:block;text-align:right">Total: ${brl(g.valor)}</small>` : ''}</span>
            <div class="reg-actions">
                <button class="btn-icon btn-edit" onclick="abrirModalGastoCartao('${g.id}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon btn-del"  onclick="excluirGastoCartao('${g.id}')"><i class="fas fa-trash"></i></button>
            </div>
        </div>`;
    }).join('');
}

// ── Navegação de mês no painel ────────────────────────────────────────────────

function ccNavMes(dir) {
    if (_ccMesSel === null) { _ccMesSel = new Date().getMonth(); _ccAnoSel = new Date().getFullYear(); }
    _ccMesSel += dir;
    if (_ccMesSel < 0)  { _ccMesSel = 11; _ccAnoSel--; }
    if (_ccMesSel > 11) { _ccMesSel = 0;  _ccAnoSel++; }
    renderizarCartoes();
}

function ccAbrirMesPicker() {
    // Reutiliza o modal de mês picker global com callbacks customizados
    const grid = document.getElementById('mes-picker-grid');
    if (!grid) return;
    grid.innerHTML = MESES_FULL.map((mn, i) =>
        `<button class="mes-picker-btn${_ccMesSel===i?' mes-picker-ativo':''}" onclick="ccSelecionarMes(${i})">${MESES_ABREV[i]}</button>`
    ).join('');
    document.getElementById('modal-mes-picker').classList.remove('hidden');
}

function ccSelecionarMes(idx) {
    _ccMesSel = idx;
    fecharModal('modal-mes-picker');
    renderizarCartoes();
}

// ── Modal de gasto ────────────────────────────────────────────────────────────

function abrirModalGastoCartao(id = null) {
    if (!_ccCartaoSel) { toast('Selecione um cartão primeiro.', 'error'); return; }

    const tit = document.getElementById('modal-gasto-titulo');
    if (tit) tit.textContent = id ? 'Editar Gasto' : 'Novo Gasto no Cartão';

    // Limpa campos
    ['gasto-edit-id','gasto-descricao','gasto-local','gasto-obs'].forEach(i => {
        const el = document.getElementById(i); if (el) el.value = '';
    });
    const valEl = document.getElementById('gasto-valor');
    if (valEl) valEl.value = '';
    const dtEl = document.getElementById('gasto-data');
    if (dtEl) dtEl.value = new Date().toISOString().slice(0, 10);
    const parcEl = document.getElementById('gasto-parcelas');
    if (parcEl) parcEl.value = '1';

    // Seta o cartão atual
    const cidEl = document.getElementById('gasto-cartao-id');
    if (cidEl) cidEl.value = _ccCartaoSel;

    // Popula categorias
    const catEl = document.getElementById('gasto-categoria');
    if (catEl) {
        const cats = getData('cat_despesas');
        catEl.innerHTML = '<option value="">Sem categoria</option>' +
            cats.map(c => `<option value="${c.id}">${c.icone} ${c.nome}</option>`).join('');
    }

    // Se edição, carrega dados
    if (id) {
        const g = getData('gastos_cartao').find(x => x.id === id);
        if (g) {
            document.getElementById('gasto-edit-id').value   = g.id;
            document.getElementById('gasto-descricao').value = g.descricao;
            document.getElementById('gasto-valor').value     = g.valor;
            document.getElementById('gasto-data').value      = g.data;
            document.getElementById('gasto-categoria').value = g.categoriaId || '';
            document.getElementById('gasto-parcelas').value  = g.parcelas || '1';
            document.getElementById('gasto-local').value     = g.local || '';
            document.getElementById('gasto-obs').value       = g.obs || '';
        }
    }

    document.getElementById('modal-gasto-cartao').classList.remove('hidden');
}

function salvarGastoCartao() {
    const desc     = document.getElementById('gasto-descricao').value.trim();
    const valor    = parseFloat(document.getElementById('gasto-valor').value);
    const data     = document.getElementById('gasto-data').value;
    const cartaoId = document.getElementById('gasto-cartao-id').value;

    if (!desc)  { toast('Informe a descrição.', 'error'); return; }
    if (!valor) { toast('Informe o valor.', 'error'); return; }
    if (!data)  { toast('Informe a data.', 'error'); return; }

    const item = {
        id:          document.getElementById('gasto-edit-id').value || uid(),
        cartaoId,
        descricao:   desc,
        valor,
        data,
        parcelas:    parseInt(document.getElementById('gasto-parcelas').value) || 1,
        categoriaId: document.getElementById('gasto-categoria').value,
        local:       document.getElementById('gasto-local').value,
        obs:         document.getElementById('gasto-obs').value
    };

    const arr    = getData('gastos_cartao', []);
    const editId = document.getElementById('gasto-edit-id').value;

    // Se é edição, precisa recalcular os meses que o item ANTIGO afetava
    if (editId) {
        const antigo = arr.find(x => x.id === editId);
        const idx    = arr.findIndex(x => x.id === editId);
        if (idx > -1) arr[idx] = item; else arr.push(item);
        localStorage.setItem('gastos_cartao', JSON.stringify(arr));
        // Recalcula meses do gasto antigo e do novo
        if (antigo) _ccRecalcularTodoCartao(antigo.cartaoId);
        if (item.cartaoId !== (antigo && antigo.cartaoId)) _ccRecalcularTodoCartao(item.cartaoId);
    } else {
        arr.push(item);
        localStorage.setItem('gastos_cartao', JSON.stringify(arr));
        // Recalcula apenas os meses afetados por este gasto
        const cartao = getData('cartoes').find(c => c.id === cartaoId);
        if (cartao) {
            const nParc = item.parcelas;
            for (let p = 0; p < nParc; p++) {
                const [y, m, d] = item.data.split('-').map(Number);
                const dataParc = new Date(y, m - 1 + p, d);
                const { mes, ano } = _ccMesFatura(dataParc.toISOString().slice(0, 10), cartao);
                _ccSincronizarAPagar(cartaoId, mes, ano);
            }
        }
    }

    toast('Gasto salvo!', 'success');
    fecharModal('modal-gasto-cartao');
    renderizarCartoes();
    if (typeof renderizarAPagar === 'function') renderizarAPagar();
    if (typeof renderizarAnalise === 'function') renderizarAnalise();
    atualizarIconeNotificacao();
}

function excluirGastoCartao(id) {
    if (!confirm('Excluir este gasto?')) return;
    const arr   = getData('gastos_cartao');
    const gasto = arr.find(x => x.id === id);
    if (!gasto) return;
    localStorage.setItem('gastos_cartao', JSON.stringify(arr.filter(x => x.id !== id)));
    // Recalcula todas as faturas afetadas
    _ccRecalcularTodoCartao(gasto.cartaoId);
    renderizarCartoes();
    if (typeof renderizarAPagar === 'function') renderizarAPagar();
    if (typeof renderizarAnalise === 'function') renderizarAnalise();
    atualizarIconeNotificacao();
    toast('Gasto excluído.', 'success');
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
    // Para análise: usa a lógica expandida de parcelas para o mês
    const apagarExpandido = _filtrarAPagarParaMes(getData('a_pagar'));
    const cartoes  = getData('cartoes');
    const cats     = getData('cat_despesas');

    // --- KPIs ---
    const despCartao = despesas.filter(d => d.tipoPagamentoVal && d.tipoPagamentoVal.startsWith('cartao_'));
    const totalCartao = despCartao.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // "Contas Pagas" no mês = despesas que vieram de A Pagar (campo _origemAPagar)
    const despOrigemAPagar = despesas.filter(d => d._origemAPagar);
    const totalPagas = despOrigemAPagar.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    // "Previsão" = total de a_pagar pendentes/vencidos no mês (parcelas expandidas)
    const totalPend = apagarExpandido.reduce((s, i) => s + (i._valorParcela || parseFloat(i.valor) || 0), 0);

    const totalDesp   = despesas.reduce((s, d) => s + (parseFloat(d.valor) || 0), 0);

    _set('kpi-cartoes',    brl(totalCartao));
    _set('kpi-cartoes-sub', despCartao.length + ' transações');
    _set('kpi-pagas',      brl(totalPagas));
    _set('kpi-pagas-sub',  despOrigemAPagar.length + ' contas');
    _set('kpi-previsao',   brl(totalPend));
    _set('kpi-total-despesas', brl(totalDesp));

    // --- Gráfico pizza ---
    _renderPizza(despesas, cats);

    // --- Top 10 ---
    _renderTop10(despesas);

    // --- Detalhamento cartões ---
    _renderDetalhamentoCartoes(despesas, cartoes);

    // --- Contas pendentes / vencidas no mês ---
    _renderContasStatus(apagarExpandido);

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
                <div class="dash-cartao-header-row">
                    <span class="dash-cartao-nome">${c.nome}</span>
                    <span class="dash-cartao-valor valor-dinheiro">${brl(total)}</span>
                </div>
                <span class="dash-cartao-sub">${c.bandeira || ''} ${c.digitos ? '····'+c.digitos : ''} · <span class="dash-cartao-qtd">${desp.length} transações</span></span>
                ${c.limite > 0 ? `
                <div class="dash-cartao-bar-wrap">
                    <div class="dash-cartao-bar" style="background:${cor};width:${pct}%"></div>
                </div>
                <span class="dash-cartao-limite">Limite: ${brl(c.limite)} · Usado: ${pct}%</span>` : ''}
            </div>
        </div>`;
    }).join('');
}

function _renderContasStatus(apagarExpandido) {
    // Pagas: despesas do mês que vieram de a_pagar
    const despMes = _filtrarPorMes(getData('despesas_gastos'), 'data');
    const pagas   = despMes.filter(d => d._origemAPagar);
    const pend    = apagarExpandido.filter(i => _statusAPagar(i) === 'pendente');
    const venc    = apagarExpandido.filter(i => _statusAPagar(i) === 'vencido');

    const _lista = (id, items, emptyIcon, isPagas) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = items.length === 0
            ? `<div class="dash-empty" style="padding:16px"><i class="fas fa-${emptyIcon}"></i><p>Nenhuma</p></div>`
            : items.map(i => {
                const nome  = isPagas ? i.descricao : (i._isParcelado ? i._parcelaNome : i.descricao);
                const valor = isPagas ? (parseFloat(i.valor) || 0) : (i._valorParcela || parseFloat(i.valor) || 0);
                const data  = isPagas ? (i.data ? `Pago: ${_fmtData(i.data)}` : '') : `Venc: ${_fmtData(i.vencimento)}`;
                return `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0;font-size:13px">
                    <div>
                        <div style="font-weight:600">${nome}</div>
                        <div style="color:#999;font-size:11px">${data}</div>
                    </div>
                    <span style="font-weight:700;color:#e74c3c" class="contas-val">${brl(valor)}</span>
                </div>`;
            }).join('');
    };

    _lista('contas-pagas-lista',     pagas, 'check-circle',          true);
    _lista('contas-pendentes-lista', pend,  'clock',                 false);
    _lista('contas-vencidas-lista',  venc,  'exclamation-triangle',  false);
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    renderizarConfiguracoes();
    atualizarIconeNotificacao();
});

// ==========================================
// BACKUP & RESTAURAÇÃO JSON
// ==========================================
function exportarBackupJSON() {
    const KEYS = ['despesas_gastos','a_pagar','receitas','cartoes','cat_despesas','cat_receitas','tipos_despesa','metas'];
    const payload = {};
    KEYS.forEach(k => {
        try { payload[k] = JSON.parse(localStorage.getItem(k) || '[]'); } catch { payload[k] = []; }
    });
    payload._exportado_em = new Date().toISOString();
    payload._versao = '1.0';

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `backup-financas-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast('Backup exportado com sucesso!', 'success');
}

function importarBackupJSON(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            const KEYS = ['despesas_gastos','a_pagar','receitas','cartoes','cat_despesas','cat_receitas','tipos_despesa','metas'];
            let count = 0;
            KEYS.forEach(k => {
                if (data[k] !== undefined) {
                    localStorage.setItem(k, JSON.stringify(data[k]));
                    count++;
                }
            });
            input.value = '';
            toast(`✅ ${count} categorias restauradas com sucesso!`, 'success');
            renderizarDados();
            if (typeof renderizarAnalise === 'function') renderizarAnalise();
        } catch(err) {
            toast('Erro ao ler o arquivo JSON. Verifique o arquivo.', 'error');
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// ==========================================
// EXPORTAR EXCEL
// ==========================================
function exportarExcel() {
    const cats = getData('cat_despesas', []);
    const catReceitas = getData('cat_receitas', []);
    const tipos = getData('tipos_despesa', []);

    const despesas = getData('despesas_gastos', []).map(d => ({
        'Data': d.data || '',
        'Descrição': d.descricao || '',
        'Valor (R$)': parseFloat(d.valor) || 0,
        'Categoria': (cats.find(c => c.id === d.categoriaId) || {}).nome || '',
        'Tipo Pagamento': (tipos.find(t => t.id === d.tipoPagamentoId) || {}).nome || '',
        'Observação': d.obs || ''
    }));

    const apagar = getData('a_pagar', []).map(d => ({
        'Vencimento': d.vencimento || '',
        'Descrição': d.descricao || '',
        'Valor (R$)': parseFloat(d.valor) || 0,
        'Categoria': (cats.find(c => c.id === d.categoriaId) || {}).nome || '',
        'Tipo': d.tipo || '',
        'Status': d.pago ? 'Pago' : (_statusAPagar(d) === 'vencido' ? 'Vencido' : 'Pendente'),
        'Tipo Pagamento': d.tipoPagamentoNome || ''
    }));

    const receitas = getData('receitas', []).map(d => ({
        'Data': d.data || '',
        'Descrição': d.descricao || '',
        'Valor (R$)': parseFloat(d.valor) || 0,
        'Categoria': (catReceitas.find(c => c.id === d.categoriaId) || {}).nome || '',
        'Observação': d.obs || ''
    }));

    // Gera CSV para cada aba e cria XLSX manualmente via base64
    function toCsv(arr) {
        if (!arr.length) return '';
        const headers = Object.keys(arr[0]);
        const rows = arr.map(row => headers.map(h => {
            const v = String(row[h] ?? '').replace(/"/g,'""');
            return `"${v}"`;
        }).join(','));
        return [headers.join(','), ...rows].join('\n');
    }

    // Usa SheetJS via CDN se disponível, caso contrário CSV
    if (typeof XLSX !== 'undefined') {
        _exportarComSheetJS(despesas, apagar, receitas);
    } else {
        // Carrega SheetJS dinamicamente
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.onload = () => _exportarComSheetJS(despesas, apagar, receitas);
        script.onerror = () => {
            // Fallback: exporta como CSV zipado
            _exportarCsvFallback(despesas, apagar, receitas, toCsv);
        };
        document.head.appendChild(script);
    }
}

function _exportarComSheetJS(despesas, apagar, receitas) {
    const wb = XLSX.utils.book_new();

    const wsDespesas = XLSX.utils.json_to_sheet(despesas.length ? despesas : [{'Sem dados': ''}]);
    const wsAPagar   = XLSX.utils.json_to_sheet(apagar.length   ? apagar   : [{'Sem dados': ''}]);
    const wsReceitas = XLSX.utils.json_to_sheet(receitas.length ? receitas : [{'Sem dados': ''}]);

    // Ajusta largura das colunas
    [wsDespesas, wsAPagar, wsReceitas].forEach(ws => {
        const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
        const cols = [];
        for (let C = range.s.c; C <= range.e.c; C++) {
            let maxLen = 10;
            for (let R = range.s.r; R <= range.e.r; R++) {
                const cell = ws[XLSX.utils.encode_cell({r:R, c:C})];
                if (cell && cell.v) maxLen = Math.max(maxLen, String(cell.v).length + 2);
            }
            cols.push({ wch: Math.min(maxLen, 40) });
        }
        ws['!cols'] = cols;
    });

    XLSX.utils.book_append_sheet(wb, wsDespesas, 'Despesas');
    XLSX.utils.book_append_sheet(wb, wsAPagar,   'A Pagar');
    XLSX.utils.book_append_sheet(wb, wsReceitas, 'Receitas');

    const nome = `financas-${new Date().toISOString().slice(0,10)}.xlsx`;
    XLSX.writeFile(wb, nome);
    toast('Planilha Excel exportada!', 'success');
}

function _exportarCsvFallback(despesas, apagar, receitas, toCsv) {
    // Exporta as 3 seções num único CSV separado por títulos
    const conteudo = [
        '=== DESPESAS ===', toCsv(despesas), '',
        '=== A PAGAR ===', toCsv(apagar), '',
        '=== RECEITAS ===', toCsv(receitas)
    ].join('\n');
    const blob = new Blob(['\uFEFF' + conteudo], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `financas-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast('Dados exportados como CSV!', 'success');
}
