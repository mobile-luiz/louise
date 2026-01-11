const WEB_APP_URL = "https://script.google.com/macros/s/AKfycbwEcdGwDvlco8kfH5XJetEifI04LdI6gYMaFpCiefILNCUPzXzwzxBRLnpo9wVzQmGq/exec"; 

// Elementos DOM
const mainContainer = document.getElementById('main-container');
const loginArea = document.getElementById('login-area');
const dashboardArea = document.getElementById('dashboard-area');
const loginBtn = document.getElementById('login-btn');
const btnSpinner = document.getElementById('btn-spinner');
const btnText = document.getElementById('btn-text');
const messageDiv = document.getElementById('message');

// Dados globais
let colaboradorDataGlobal = {};
let escalas6x2Data = {};

// Constantes
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
                     "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "dezembro"];

// ==========================================
// FUNÇÕES AUXILIARES PARA DATAS
// ==========================================

function formatarDataBrasil(data) {
    if (!(data instanceof Date) || isNaN(data.getTime())) {
        return "Data inválida";
    }
    const dia = data.getDate().toString().padStart(2, '0');
    const mes = (data.getMonth() + 1).toString().padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

function parseData(dataStr) {
    if (!dataStr || typeof dataStr !== 'string') return null;
    
    try {
        if (dataStr.includes('1899') || dataStr.includes('GMT')) {
            console.log('⚠️ Data problemática detectada, tentando extrair:', dataStr);
            
            const regex = /([A-Z]{3})\s+([A-Z]{3})\s+(\d{1,2})\s+(\d{4})/;
            const match = dataStr.match(regex);
            
            if (match) {
                const meses = {
                    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
                    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
                };
                
                const dia = parseInt(match[3], 10);
                const mes = meses[match[2]];
                const ano = parseInt(match[4], 10);
                
                if (!isNaN(dia) && mes !== undefined && !isNaN(ano)) {
                    return new Date(ano, mes, dia);
                }
            }
            return null;
        }
        
        const partes = dataStr.split('/');
        if (partes.length !== 3) return null;
        
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const ano = parseInt(partes[2], 10);
        
        const data = new Date(ano, mes, dia);
        return isNaN(data.getTime()) ? null : data;
    } catch (error) {
        console.error('Erro ao parsear data:', error, dataStr);
        return null;
    }
}

function corrigirDiaProblema(dia) {
    if (!dia) return dia;
    
    if (dia.data && (dia.data.includes('1899') || dia.data.includes('GMT') || 
                     dia.data.includes('SAT') || dia.data.includes('DEC'))) {
        
        console.log('🔧 Corrigindo dia problemático:', dia.data);
        
        dia.status = 'TRABALHA';
        dia.isTrabalho = true;
        dia.isFolga = false;
        
        if (dia.data.includes('DEC') || dia.data.includes('SAT')) {
            try {
                const dateMatch = dia.data.match(/(\w{3})\s+(\w{3})\s+(\d{1,2})\s+(\d{4})/);
                if (dateMatch) {
                    const meses = {
                        'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
                        'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
                    };
                    const mes = meses[dateMatch[2]];
                    const diaNum = parseInt(dateMatch[3]);
                    const ano = parseInt(dateMatch[4]);
                    
                    if (!isNaN(diaNum) && mes !== undefined && !isNaN(ano)) {
                        const dataReal = new Date(ano, mes, diaNum);
                        dia.data = formatarDataBrasil(dataReal);
                        const diasSemana = ['Domingo', 'Segunda-feira', 'Terça-feira', 
                                          'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
                        dia.diaSemana = diasSemana[dataReal.getDay()];
                        console.log('✅ Data corrigida para:', dia.data);
                    }
                }
            } catch (e) {
                console.warn('Não foi possível extrair data:', e);
            }
        }
        
        if (!dia.diaSemana && dia.dataOriginal) {
            dia.diaSemana = dia.dataOriginal;
        }
    }
    
    if (!dia.status || dia.status === '' || dia.status.includes('1899')) {
        dia.status = dia.isFolga ? 'FOLGA' : 'TRABALHA';
        dia.isTrabalho = !dia.isFolga;
    }
    
    return dia;
}

function obterStatusDia(escalaLetra, data) {
    const letra = escalaLetra.toUpperCase();
    
    if (!escalas6x2Data.dadosPorEscala || !escalas6x2Data.dadosPorEscala[letra]) {
        return null;
    }
    
    const dataFormatada = formatarDataBrasil(data);
    
    const diaEncontrado = escalas6x2Data.dadosPorEscala[letra].dias.find(dia => {
        if (!dia || !dia.data) return false;
        
        const dataParseada = parseData(dia.data);
        if (!dataParseada) return false;
        
        return dataParseada.getTime() === data.getTime();
    });
    
    if (diaEncontrado) {
        const diaCorrigido = corrigirDiaProblema(diaEncontrado);
        
        return {
            status: diaCorrigido.status || 'TRABALHA',
            isTrabalho: diaCorrigido.isTrabalho !== undefined ? diaCorrigido.isTrabalho : true,
            isFolga: diaCorrigido.isFolga !== undefined ? diaCorrigido.isFolga : false,
            diaSemana: diaCorrigido.diaSemana || '',
            dataOriginal: diaCorrigido.data
        };
    }
    
    return null;
}

function sanitizarDadosEscala(dados) {
    if (!dados || !dados.dadosPorEscala) return dados;
    
    console.log('🧹 Sanitizando dados da escala...');
    let totalCorrigidos = 0;
    
    Object.keys(dados.dadosPorEscala).forEach(escala => {
        const dias = dados.dadosPorEscala[escala].dias;
        
        if (Array.isArray(dias)) {
            const diasCorrigidos = dias.map(dia => {
                const diaOriginal = dia.data;
                const diaCorrigido = corrigirDiaProblema(dia);
                
                if (diaOriginal !== diaCorrigido.data || 
                    dia.status !== diaCorrigido.status) {
                    totalCorrigidos++;
                }
                
                return diaCorrigido;
            });
            
            dados.dadosPorEscala[escala].dias = diasCorrigidos;
            console.log(`✅ Escala ${escala}: ${dias.length} dias processados`);
        }
    });
    
    console.log(`📊 Total de dias corrigidos: ${totalCorrigidos}`);
    return dados;
}

// ==========================================
// FUNÇÕES DA API
// ==========================================

async function carregarEscala6x2() {
    try {
        console.log('📊 Carregando escala 6x2...');
        const response = await fetch(`${WEB_APP_URL}?tipo=escala_6x2`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && data.dadosPorEscala) {
            escalas6x2Data = sanitizarDadosEscala(data);
            
            const totalDias = Object.values(escalas6x2Data.dadosPorEscala)
                .reduce((total, escala) => total + (escala.dias?.length || 0), 0);
            
            const diasComDados = Object.values(escalas6x2Data.dadosPorEscala)
                .reduce((total, escala) => {
                    return total + (escala.dias?.filter(d => 
                        d.status && !d.status.includes('1899')
                    ).length || 0);
                }, 0);
            
            console.log(`✅ Escala carregada e corrigida: ${totalDias} dias totais`);
            console.log(`📊 Dias com dados válidos: ${diasComDados}/${totalDias}`);
            console.log(`📅 Período: ${escalas6x2Data.periodo?.inicio || 'N/A'} a ${escalas6x2Data.periodo?.fim || 'N/A'}`);
            
            return { success: true };
        }
        
        throw new Error('Dados inválidos da API');
        
    } catch (error) {
        console.error('❌ Erro ao carregar escala:', error);
        messageDiv.style.color = 'orange';
        messageDiv.textContent = 'Escala carregada parcialmente. Algumas datas foram corrigidas automaticamente.';
        setTimeout(() => messageDiv.textContent = '', 4000);
        return { success: false };
    }
}

async function carregarMinhaEscala6x2() {
    try {
        const matricula = colaboradorDataGlobal.matricula;
        if (!matricula) return null;
        
        console.log('🔍 Carregando minha escala...');
        const response = await fetch(`${WEB_APP_URL}?tipo=minha_escala_6x2&matricula=${encodeURIComponent(matricula)}`);
        
        if (!response.ok) {
            throw new Error(`Erro HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            console.log('✅ Minha escala carregada');
            
            data.hoje = corrigirDiaProblema(data.hoje);
            data.amanha = corrigirDiaProblema(data.amanha);
            
            if (data.proximosDias && Array.isArray(data.proximosDias)) {
                data.proximosDias = data.proximosDias.map(dia => {
                    const corrigido = corrigirDiaProblema(dia);
                    return corrigido;
                }).filter(dia => dia && dia.data);
                
                console.log(`📅 Próximos dias após correção: ${data.proximosDias.length}`);
            }
            
            return data;
        }
        
        return null;
        
    } catch (error) {
        console.error('❌ Erro ao carregar minha escala:', error);
        return null;
    }
}

// ==========================================
// FUNÇÕES DE INTERFACE
// ==========================================

function getTurnoClass(turno) {
    if (turno.includes('T1')) return 'turno-t1';
    if (turno.includes('T2')) return 'turno-t2';
    if (turno.includes('T3')) return 'turno-t3';
    return '';
}

function getStatusText(dia) {
    if (!dia) return 'INDEFINIDO';
    
    if (dia.status) {
        const statusUpper = dia.status.toUpperCase();
        if (statusUpper.includes('TRABALHA') || statusUpper.includes('TRAB')) return 'TRABALHA';
        if (statusUpper.includes('FOLGA') || statusUpper === 'F') return 'FOLGA';
        return dia.status;
    }
    
    if (dia.isTrabalho) return 'TRABALHA';
    if (dia.isFolga) return 'FOLGA';
    
    return 'INDEFINIDO';
}

function populateMonthSelector() {
    const select = document.getElementById('month-select');
    if (!select) return;
    
    select.innerHTML = '';
    const now = new Date();

    for (let i = -1; i < 13; i++) {
        const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
        const opt = document.createElement('option');
        opt.value = `${date.getFullYear()}-${date.getMonth().toString().padStart(2, '0')}`;
        opt.textContent = `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
        
        if (i === 0) opt.selected = true;
        select.appendChild(opt);
    }
}

function updateCalendar() {
    const select = document.getElementById('month-select');
    if (!select || !select.value) return;

    const [targetYear, targetMonth] = select.value.split('-').map(Number);
    const escalaLetra = (colaboradorDataGlobal.escalaLetra || "A").toUpperCase();
    
    const firstDayOfMonth = new Date(targetYear, targetMonth, 1);
    const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const startingDayOfWeek = firstDayOfMonth.getDay();
    
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    const weekDays = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
    let html = weekDays.map(d => `<div class="day-name">${d}</div>`).join('');
    
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="empty-day"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const dateIter = new Date(targetYear, targetMonth, day);
        dateIter.setHours(0, 0, 0, 0);
        
        const statusDia = obterStatusDia(escalaLetra, dateIter);
        
        let className = 'day-cell ';
        let statusText = '-';
        let tooltipText = `${day}/${targetMonth + 1}/${targetYear}`;
        
        if (statusDia) {
            if (statusDia.isTrabalho) {
                className += 'trabalho';
                statusText = 'TRAB';
                tooltipText += '\nTRABALHA';
            } else if (statusDia.isFolga) {
                className += 'folga';
                statusText = 'FOLGA';
                tooltipText += '\nFOLGA';
            } else {
                className += 'indefinido';
                statusText = statusDia.status || '-';
                tooltipText += '\nINDEFINIDO';
            }
            
            if (statusDia.diaSemana) {
                tooltipText = `${statusDia.diaSemana} - ${tooltipText}`;
            }
        } else {
            className += 'indefinido';
            tooltipText += '\nSem dados na escala';
        }
        
        const isHoje = dateIter.getTime() === hoje.getTime();
        const isPassado = dateIter < hoje;
        
        if (isHoje) {
            className += ' today';
            tooltipText += '\n⭐ HOJE';
        }
        if (isPassado) className += ' past-day';
        
        if (window.innerWidth < 768) {
            if (statusText.includes('TRAB')) statusText = 'T';
            if (statusText.includes('FOLGA')) statusText = 'F';
        }
        
        html += `
            <div class="${className}" title="${tooltipText.replace(/\n/g, '&#10;')}">
                <div class="day-number">${day}</div>
                <div class="day-status">${statusText}</div>
                ${isHoje ? '<span class="hoje-badge">HOJE</span>' : ''}
            </div>
        `;
    }
    
    document.getElementById('calendar-body').innerHTML = html;
}


function showDashboard() {
    loginArea.style.display = 'none';
    dashboardArea.style.display = 'block';
    mainContainer.classList.add('dashboard-mode');
    
    const user = colaboradorDataGlobal;
    const nomeCurto = user.nome ? user.nome.split(' ')[0] : "Usuário";
    const matricula = user.matricula || "---";
    const turno = user.turno || "Não informado";
    const escalaLetra = (user.escalaLetra && user.escalaLetra !== "-" && user.escalaLetra !== "") 
                        ? user.escalaLetra.toUpperCase() 
                        : "Não informado";
    
    let ultimoAcesso = user.ultimoAcesso || 'Primeiro acesso';
    
    // --- LÓGICA DE STATUS HOJE (Sincronizada com o Calendário) ---
    const hojeData = new Date();
    hojeData.setHours(0, 0, 0, 0);
    
    const statusHoje = obterStatusDia(escalaLetra, hojeData);
    
    let statusTextoExibicao = "SEM DADOS";
    let classeStatus = "indefinido"; 
    let classeIcone = "indefinido";  
    let simboloIcone = "?";

    if (statusHoje) {
        if (statusHoje.isTrabalho) {
            statusTextoExibicao = "TRABALHA";
            classeStatus = "status-trabalha";
            classeIcone = "trabalho";
            simboloIcone = "✓";
        } else if (statusHoje.isFolga) {
            statusTextoExibicao = "FOLGA";
            classeStatus = "status-folga";
            classeIcone = "folga";
            simboloIcone = "✕";
        }
    }

    // --- RENDERIZAÇÃO DO HTML (Incluindo Perfil e Grid) ---
    document.getElementById('data-area').innerHTML = `
        <div class="dashboard-card">
            <div class="user-profile">
                <div class="user-avatar"><span>${nomeCurto.charAt(0)}</span></div>
                <div class="user-info">
                    <h2 class="user-name">${user.nome}</h2>
                    <p>Matrícula: <strong>${matricula}</strong></p>
                    <p>Turno: <strong>${turno}</strong></p>
                </div>
            </div>

            <div class="dashboard-grid">
                <div class="info-box">
                    <div class="info-label">GRUPO</div>
                    <div class="escala-value" style="font-size: ${escalaLetra.length > 1 ? '16px' : '24px'}">
                        ${escalaLetra}
                    </div>
                </div>
                <div class="info-box highlight-box">
                    <div class="info-label">STATUS HOJE</div>
                    <div class="status-display">
                        <div class="status-icon ${classeIcone}">${simboloIcone}</div>
                        <div class="status-text ${classeStatus}">${statusTextoExibicao}</div>
                    </div>
                </div>
                <div class="info-box">
                    <div class="info-label">ÚLTIMO ACESSO</div>
                    <div class="acesso-value">${ultimoAcesso}</div>
                </div>
            </div>
        </div>
    `;
    
    if (typeof populateMonthSelector === "function") populateMonthSelector();
    if (typeof updateCalendar === "function") updateCalendar();
}

// CSS DASHBOARD COMPLETO - CORES REAIS
// ==========================================
const premiumStyle = document.createElement('style');
premiumStyle.textContent = `
    /* -- Reset e Base -- */
    .dashboard-mode {
        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
        -webkit-font-smoothing: antialiased;
        background-color: #f8f9fa;
        color: #2d3436;
        padding: 20px;
    }

    /* -- Header e Cartão Principal -- */
    .dashboard-card {
        background: #ffffff;
        border-radius: 24px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.05);
        padding: 30px;
        margin-bottom: 30px;
        border: 1px solid rgba(0,0,0,0.05);
    }

    /* -- Perfil do Usuário -- */
    .user-profile {
        display: flex;
        align-items: center;
        gap: 20px;
        padding-bottom: 25px;
        border-bottom: 2px solid #f1f2f6;
        margin-bottom: 25px;
    }

    .user-avatar {
        width: 70px; height: 70px;
        background: linear-gradient(135deg, #6C5CE7 0%, #a29bfe 100%);
        color: white; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 26px; font-weight: 800;
        box-shadow: 0 8px 15px rgba(108, 92, 231, 0.2);
    }

    .user-info h2 { font-size: 1.4rem; font-weight: 900; margin: 0; text-transform: uppercase; }
    .user-info p { margin: 2px 0; font-size: 0.9rem; color: #636e72; font-weight: 600; }

    /* -- Grid de Informações Superiores -- */
    .dashboard-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin-bottom: 30px;
    }

    .info-box {
        background: #fff;
        border: 1px solid #f1f2f6;
        border-left: 6px solid #FFC107;
        border-radius: 16px;
        padding: 20px;
        display: flex;
        flex-direction: column;
    }

    .info-label {
        font-size: 0.7rem;
        font-weight: 900;
        color: #000;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
    }

    .escala-value { font-size: 2.5rem; font-weight: 900; color: #4eb973; line-height: 1; }
    
    .status-display { display: flex; align-items: center; gap: 10px; margin-top: 5px; }
    .status-icon { width: 30px; height: 30px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; }
    .status-icon.trabalho { background: #4eb973; }
    .status-text { font-size: 1.2rem; font-weight: 900; }

    /* -- CALENDÁRIO (Cores da Imagem) -- */
    .calendar-container { background: #fff; border-radius: 20px; }
    .calendar-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    .calendar-title { font-size: 1.1rem; font-weight: 800; }

    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
    }

   .day-name {
        text-align: center;
        padding: 12px 0;
        font-weight: 900; /* Peso máximo para a fonte */
        color: #1a1a1a;   /* Cor quase preta para máximo contraste */
        font-size: 0.85rem; /* Aumentado um pouco o tamanho */
        text-transform: uppercase;
        background-color: #f1f2f6; /* Um fundo leve para separar do cabeçalho */
        border-radius: 6px;
        margin-bottom: 5px;
        letter-spacing: 0.5px;
    }

    .day-cell {
        aspect-ratio: 1 / 1;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        position: relative;
        transition: transform 0.2s;
        background: #f8f9fa; /* Fundo padrão para dias sem escala */
    }

    /* CORES REAIS DA IMAGEM */
    .day-cell.trabalho { background-color: #4eb973 !important; }
    .day-cell.folga { background-color: #e65b65 !important; }

    .day-number { font-weight: 800; color: #fff; font-size: 1.3rem; line-height: 1; }
    .day-status { font-weight: 700; color: #fff; font-size: 0.65rem; text-transform: uppercase; margin-top: 4px; }

    /* Quando o dia não tem cor (ex: fora do mês), o número volta a ser escuro */
    .day-cell:not(.trabalho):not(.folga) .day-number { color: #2d3436; }

    /* DESTAQUE HOJE (Borda Amarela da Imagem) */
    .day-cell.today {
        border: 4px solid #f1c40f !important;
        z-index: 10;
        box-shadow: 0 4px 15px rgba(0,0,0,0.1);
    }

    .hoje-badge {
        position: absolute;
        top: 2px;
        right: 2px;
        background: #f1c40f;
        color: #000;
        font-size: 0.5rem;
        font-weight: 900;
        padding: 1px 4px;
        border-radius: 3px;
    }

    /* -- Rodapé e Botões -- */
    .actions-footer {
        display: flex;
        justify-content: space-between;
        margin-top: 25px;
        padding-top: 20px;
        border-top: 1px solid #f1f2f6;
    }

    .btn-pdf {
        background: #2d3436; color: #fff; border: none;
        padding: 10px 20px; border-radius: 8px;
        font-weight: 700; cursor: pointer;
        display: flex; align-items: center; gap: 8px;
    }

    /* -- Responsividade -- */
    @media (max-width: 768px) {
        .dashboard-grid { grid-template-columns: 1fr; }
        .calendar-grid { gap: 4px; }
        .day-number { font-size: 0.9rem; }
        .day-status { font-size: 0.5rem; }
    }
        
`;






// Remover estilo anterior se existir
const oldStyle = document.querySelector('style[data-dashboard-style]');
if (oldStyle) oldStyle.remove();
premiumStyle.setAttribute('data-dashboard-style', 'true');
document.head.appendChild(premiumStyle);

// ==========================================
// EVENT LISTENERS
// ==========================================

document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const matricula = document.getElementById('matricula').value.trim().toUpperCase();
    const nome = document.getElementById('nome').value.trim().toUpperCase();
    
    if (!matricula) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Digite sua matrícula';
        return;
    }
    
    loginBtn.disabled = true;
    btnSpinner.style.display = 'block';
    btnText.textContent = 'Autenticando...';
    messageDiv.textContent = '';
    
    try {
        await carregarEscala6x2();
        
        const response = await fetch(`${WEB_APP_URL}?matricula=${encodeURIComponent(matricula)}&nome=${encodeURIComponent(nome)}`);
        const data = await response.json();
        
        if (data.success) {
            colaboradorDataGlobal = data.dados;
            
            const minhaEscalaData = await carregarMinhaEscala6x2();
            if (minhaEscalaData) {
                colaboradorDataGlobal.minhaEscala6x2 = minhaEscalaData;
            }
            
            showDashboard();
            messageDiv.style.color = 'green';
            messageDiv.textContent = 'Login realizado com sucesso!';
            setTimeout(() => messageDiv.textContent = '', 2000);
        } else {
            messageDiv.style.color = 'red';
            messageDiv.textContent = data.message || 'Dados incorretos. Tente novamente.';
        }
    } catch (error) {
        console.error('Erro no login:', error);
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Erro de conexão. Tente novamente.';
    } finally {
        loginBtn.disabled = false;
        btnSpinner.style.display = 'none';
        btnText.textContent = 'Entrar no Sistema';
    }
});


function logout() { location.reload(); }




async function downloadPDF() {
    const btn = document.querySelector('button[onclick="downloadPDF()"]');
    if (!btn || !window.jspdf || !html2canvas) {
        alert('Bibliotecas PDF não carregadas.');
        return;
    }

    btn.textContent = "Gerando...";
    btn.disabled = true;

    const element = document.getElementById('main-container');
    const originalStyle = element.getAttribute('style');

    // 1. Forçamos uma largura que caiba bem no A4 sem compressão excessiva
    element.style.width = '800px'; 
    element.style.maxWidth = 'none';
    element.style.background = '#ffffff';

    await new Promise(resolve => setTimeout(resolve, 500));

    const opt = { 
        scale: 2, // Resolução boa sem criar um arquivo pesado demais
        useCORS: true,
        logging: false,
        windowWidth: 800
    };

    html2canvas(element, opt).then(canvas => {
        const { jsPDF } = window.jspdf;
        
        // 2. Pegamos as dimensões da imagem gerada
        const imgData = canvas.toDataURL('image/png');
        const canvasWidth = canvas.width;
        const canvasHeight = canvas.height;

        // 3. Criamos o PDF com base no tamanho do conteúdo para evitar cortes
        // Se a altura for maior que a largura, usamos 'p' (retrato), senão 'l' (paisagem)
        const orientation = canvasHeight > canvasWidth ? 'p' : 'l';
        const pdf = new jsPDF(orientation, 'mm', 'a4');

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // 4. Ajustamos a imagem para ocupar a largura da página com margens pequenas
        const margin = 10;
        const imgWidth = pageWidth - (margin * 2);
        const imgHeight = (canvasHeight * imgWidth) / canvasWidth;

        // 5. Verificação de quebra: se a imagem for maior que a página, 
        // o jsPDF permite adicionar a imagem, mas aqui garantimos o ajuste
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight);
        
        pdf.save(`Escala_${colaboradorDataGlobal.nome || 'Colaborador'}.pdf`);

        // Restaurar layout
        if (originalStyle) element.setAttribute('style', originalStyle);
        else element.removeAttribute('style');

        btn.textContent = "💾 Baixar PDF";
        btn.disabled = false;
    }).catch(err => {
        console.error(err);
        btn.textContent = "❌ Erro";
        if (originalStyle) element.setAttribute('style', originalStyle);
        setTimeout(() => { btn.textContent = "💾 Baixar PDF"; btn.disabled = false; }, 2000);
    });
}
// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', function() {
    populateMonthSelector();
    
    if (dashboardArea) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (dashboardArea.style.display === 'block') {
                    // Apenas inicializar calendário
                }
            });
        });
        
        observer.observe(dashboardArea, { 
            attributes: true, 
            attributeFilter: ['style'] 
        });
    }
    
    document.getElementById('month-select')?.addEventListener('change', function() {
        if (colaboradorDataGlobal.nome) {
            updateCalendar();
        }
    });
    
    window.addEventListener('resize', function() {
        if (colaboradorDataGlobal.nome) {
            updateCalendar();
        }
    });
});