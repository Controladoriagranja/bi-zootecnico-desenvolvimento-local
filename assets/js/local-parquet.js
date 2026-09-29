/**
 * MAPA DE FÓRMULAS: ./FORMULAS.md
 * Motor local: médias ponderadas do index/detalhes, somas RxP e rota alternativa de lotes.
 */
(function () {
    const MESES = [
        "janeiro", "fevereiro", "março", "abril", "maio", "junho",
        "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"
    ];
    const DIM = {
        status_acerto: "Status Acerto",
        tipo_granja: "Tipo de Granja",
        modelo: "Modelo",
        produtor: "Produtor",
        tecnico: "Técnico",
        linhagem: "Linhagem",
        galpao: "Galpão"
    };
    const LOTES_DIM = {
        tecnico: "Técnico",
        granja: "Nome Granja",
        galpao: "Galp",
        linhagem: "Linhagem",
        tipo_granja: "Tipo Granja"
    };
    const FAIXAS = {
        "0-7": [0, 7], "8-14": [8, 14], "15-21": [15, 21],
        "22-28": [22, 28], "29-35": [29, 35], "36-45": [36, 45]
    };

    const cache = { base: null, lotesRaw: null, lotes: null };

    function requireLocalRows(name, value) {
        if (!Array.isArray(value)) {
            throw new Error(`Dados locais não carregados: ${name}. Verifique se o arquivo JS da pasta data foi incluído no HTML.`);
        }
        return value;
    }

    /**
     * FÓRMULA: Conversão numérica
     * Converte números e textos numéricos; valores inválidos ou ausentes retornam null. É a base para
     * decidir quais linhas entram nas médias.
     * Passo a passo (pseudocódigo):
     *   numero = converter(valor); se inválido: retornar null
     */
    function n(value) {
        if (value === null || value === undefined || value === "") return null;
        if (typeof value === "number") return Number.isFinite(value) ? value : null;
        const parsed = Number(String(value).trim().replace(",", "."));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function asDate(value) {
        if (!value) return null;
        if (value instanceof Date) return value;
        if (typeof value === "bigint") return new Date(Number(value / 1000000n));
        const text = String(value);
        const d = new Date(text);
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function ymd(value) {
        const d = asDate(value);
        if (!d) return null;
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    }

    function list(v) {
        if (Array.isArray(v)) return v.map(String).filter(Boolean);
        if (v === null || v === undefined || v === "") return [];
        return [String(v)];
    }

    function rowTypeLinhagem(row) {
        const value = String(row.Linhagem || "").trim();
        if (!value) return "";
        return value.includes("/") ? "mista" : "pura";
    }

    /**
     * FÓRMULA: Contexto do desempenho
     * Aplica data de abate, ano a partir de 2023 e filtros de dimensões, mês e intervalo antes das
     * agregações.
     * Passo a passo (pseudocódigo):
     *   linhas = base que atende datas e filtros
     */
    function matchBase(row, filters = {}, exclude = null) {
        const d = asDate(row["Data de Abate"] ?? row["Data Abate"]);
        if (!d || d.getFullYear() < 2023) return false;

        for (const [key, col] of Object.entries(DIM)) {
            if (key === exclude) continue;
            const selected = list(filters[key]);
            if (selected.length && !selected.includes(String(row[col] ?? "").trim())) return false;
        }
        if (exclude !== "tipo_linhagem") {
            const selected = list(filters.tipo_linhagem);
            if (selected.length && !selected.includes(rowTypeLinhagem(row))) return false;
        }
        if (exclude !== "ano") {
            const selected = list(filters.ano).map(Number);
            if (selected.length && !selected.includes(d.getFullYear())) return false;
        }
        if (exclude !== "mes") {
            const selected = list(filters.mes).map(Number);
            if (selected.length && !selected.includes(d.getMonth() + 1)) return false;
        }
        if (filters.data_inicio && ymd(d) < String(filters.data_inicio)) return false;
        if (filters.data_fim && ymd(d) > String(filters.data_fim)) return false;
        return true;
    }

    async function baseRows() {
        if (!cache.base) {
            cache.base = requireLocalRows("BASE_DINAMICA_ROWS", window.BASE_DINAMICA_ROWS);
        }
        return cache.base;
    }

    /**
     * FÓRMULA: Soma de aves e média ponderada
     * Aves Abatidas: soma da coluna, ausentes contam zero. Demais indicadores: soma(valor × Aves Abatidas)
     * / soma(Aves Abatidas) apenas dos pares numéricos válidos. Vazio < 7 ou > 18 vira 14 antes da
     * multiplicação; esses registros continuam no denominador. Denominador zero retorna null. Percentuais
     * já estão em %, sem multiplicar por 100.
     * Passo a passo (pseudocódigo):
     *   se aves_abatidas: retornar soma([Aves Abatidas])
     *   numerador = 0; denominador = 0
     *   para cada linha com valor e aves válidos:
     *     se indicador == vazio e (valor < 7 ou valor > 18): valor = 14
     *     numerador += valor * aves
     *     denominador += aves
     *   retornar denominador != 0 ? numerador / denominador : null
     */
    function metricValue(rows, metricId) {
        const metric = window.METRICAS?.[metricId];
        if (!metric) return null;
        if (metricId === "aves_abatidas") {
            return rows.reduce((sum, row) => sum + (n(row[metric.coluna]) || 0), 0);
        }
        let num = 0, den = 0;
        rows.forEach(row => {
            let value = n(row[metric.coluna]);
            const weight = n(row["Aves Abatidas"]);
            if (value === null || weight === null) return;
            if (metricId === "vazio" && (value < 7 || value > 18)) value = 14;
            num += value * weight;
            den += weight;
        });
        return den ? num / den : null;
    }

    async function filtrosBase(filters) {
        const rows = await baseRows();
        const out = {};
        for (const [key, col] of Object.entries(DIM)) {
            const vals = opcoesDisponiveis(key, rows, filters, matchBase, r => String(r[col] ?? "").trim());
            out[key] = vals;
        }
        out.tipo_linhagem = opcoesDisponiveis("tipo_linhagem", rows, filters, matchBase, rowTypeLinhagem).map(v => ({valor:v,nome:v === "mista" ? "Mista" : "Pura"}));
        out.ano = opcoesDisponiveis("ano", rows, filters, matchBase, r => asDate(r["Data de Abate"] ?? r["Data Abate"])?.getFullYear()).map(Number).sort((a,b)=>b-a);
        out.mes = opcoesDisponiveis("mes", rows, filters, matchBase, r => asDate(r["Data de Abate"] ?? r["Data Abate"]).getMonth()+1).map(Number).sort((a,b)=>a-b).map(m=>({valor:m,nome:MESES[m-1]}));
        return out;
    }

    /**
     * FÓRMULA: Mensal e total anual
     * Reaplica metricValue às linhas de cada mês e de cada ano. O total anual não é a média das médias
     * mensais.
     * Passo a passo (pseudocódigo):
     *   para cada ano:
     *     total = metricValue(linhas do ano)
     *     para cada mês: mensal = metricValue(linhas do mês)
     */
    async function desempenho(filters) {
        const all = await baseRows();
        const rows = all.filter(r => matchBase(r, filters));
        const anos = [...new Set(rows.map(r=>asDate(r["Data de Abate"] ?? r["Data Abate"])?.getFullYear()).filter(y=>y>=2023))].sort((a,b)=>a-b);
        const indicadores = {};
        (window.BI_METRIC_ORDER || Object.keys(window.METRICAS || {})).forEach(id => {
            const metric = window.METRICAS[id];
            const porAno = Object.fromEntries(anos.map(a=>[String(a),Array(12).fill(null)]));
            const totais = Object.fromEntries(anos.map(a=>[String(a),null]));
            anos.forEach(ano => {
                const anoRows = rows.filter(r=>asDate(r["Data de Abate"] ?? r["Data Abate"])?.getFullYear()===ano);
                totais[String(ano)] = metricValue(anoRows,id);
                for(let m=1;m<=12;m+=1){
                    const mr=anoRows.filter(r=>(asDate(r["Data de Abate"] ?? r["Data Abate"])?.getMonth()+1)===m);
                    porAno[String(ano)][m-1]=mr.length?metricValue(mr,id):null;
                }
            });
            indicadores[id]={id,nome:metric.nome,unidade:metric.unidade||"",casas_decimais:metric.casas_decimais??2,por_ano:porAno,totais};
        });
        return {arquivo:"indice_zootecnico_base_dinamica_tratado.parquet",atualizado_em:"Dados locais",anos,meses:MESES.map((nome,i)=>({numero:i+1,nome})),indicadores};
    }

    /**
     * FÓRMULA: Valor, ranking e evolução
     * Usa metricValue para o valor geral, grupos por Técnico/Produtor e meses. Rankings excluem valor
     * null, ordenam decrescente e limitam a 20 grupos. Com o mesmo contexto, o valor coincide com o index.
     * Passo a passo (pseudocódigo):
     *   valor = metricValue(linhas filtradas)
     *   ranking = metricValue(linhas de cada técnico ou produtor)
     *   evolução = metricValue(linhas de cada ano/mês)
     */
    async function detalhes(filters) {
        const indicador = String(filters.indicador || "gmd");
        const metric = window.METRICAS[indicador];
        if (!metric) throw new Error(`Indicador inválido: ${indicador}`);
        const all = await baseRows();
        const rows = all.filter(r => matchBase(r, filters));
        const ranking = col => {
            const map = new Map();
            rows.forEach(r=>{ const k=String(r[col]||"").trim(); if(k){ if(!map.has(k))map.set(k,[]); map.get(k).push(r); }});
            return [...map.entries()].map(([nome,rs])=>({nome,valor:metricValue(rs,indicador)})).filter(x=>x.valor!==null).sort((a,b)=>b.valor-a.valor).slice(0,20);
        };
        const anos=[...new Set(rows.map(r=>asDate(r["Data de Abate"] ?? r["Data Abate"])?.getFullYear()).filter(y=>y>=2023))].sort((a,b)=>a-b);
        const series=anos.map(ano=>({ano,valores:Array.from({length:12},(_,i)=>{const rs=rows.filter(r=>{const d=asDate(r["Data de Abate"] ?? r["Data Abate"]);return d&&d.getFullYear()===ano&&d.getMonth()===i;});return rs.length?metricValue(rs,indicador):null;})}));
        return {arquivo:"indice_zootecnico_base_dinamica_tratado.parquet",atualizado_em:"Dados locais",indicador:{id:indicador,nome:metric.nome,unidade:metric.unidade||"",casas_decimais:metric.casas_decimais??2,valor:metricValue(rows,indicador)},ranking_tecnicos:ranking("Técnico"),ranking_produtores:ranking("Produtor"),evolucao:{meses:MESES.map((nome,i)=>({numero:i+1,nome})),series},filtros:filters};
    }

    async function rawLotes() {
        if (!cache.lotesRaw) {
            cache.lotesRaw = requireLocalRows("LOTES_ABERTOS_ROWS", window.LOTES_ABERTOS_ROWS);
        }
        return cache.lotesRaw;
    }

    function daysBetween(a,b){ const x=asDate(a),y=asDate(b); if(!x||!y)return null; return Math.floor((y-x)/86400000); }
    /**
     * FÓRMULA: Rota alternativa de lotes
     * Não é o cálculo usado diretamente por lotes.html. Usa maior Data_Analise, última versão por Codigo
     * Granja + Num Lote + Galp e idade 0..45 relativa à análise. Soma mortes e descartes de 7..42; aves
     * atuais = máximo(iniciais - mortes - descartes, 0). Mortalidade desta rota usa somente mortes /
     * iniciais × 100. Peso: primeiro não nulo de 42 até 7, depois Ps Pinto.
     * Passo a passo (pseudocódigo):
     *   idade = piso((Data_Analise - Data Recepcao) / 86400000)
     *   aves_atuais = max(Aves Inicia - mortes - descartes, 0)
     *   mortalidade = mortes / Aves Inicia * 100
     */
    async function lotesData(){
        if(cache.lotes)return cache.lotes;
        const raw=await rawLotes();
        const dates=raw.map(r=>asDate(r.Data_Analise)).filter(Boolean);
        const latest=new Date(Math.max(...dates.map(d=>d.getTime())));
        const same=raw.filter(r=>ymd(r.Data_Analise)===ymd(latest));
        const map=new Map();
        same.forEach(r=>{
            const key=[r["Codigo Granja"],r["Num Lote"],r.Galp].join("|");
            const prev=map.get(key); const cur=asDate(r.Periodo_Arquivo_Fim)?.getTime()||0; const old=prev?(asDate(prev.Periodo_Arquivo_Fim)?.getTime()||0):-1;
            if(!prev||cur>=old)map.set(key,r);
        });
        const rows=[];
        for(const r of map.values()){
            const idade=daysBetween(r["Data Recepcao"],r.Data_Analise); if(idade===null||idade<0||idade>45)continue;
            const aloj=n(r["Aves Inicia"])||0;
            let mortes=0,desc=0;
            [7,14,21,28,35,42].forEach(age=>{mortes+=n(r[`Qtde Mort Sem-${String(age).padStart(2,"0")}`])||0;desc+=n(r[`Qtde Desc Sem-${String(age).padStart(2,"0")}`])||0;});
            const atual=Math.max(aloj-mortes-desc,0);
            let peso=null; for(const age of [42,35,28,21,14,7]){peso=n(r[`Peso Med.-${String(age).padStart(2,"0")}`]);if(peso!==null)break;} if(peso===null)peso=n(r["Ps Pinto"]);
            rows.push({codigo_granja:String(r["Codigo Granja"]??""),granja:String(r["Nome Granja"]??""),lote:String(r["Num Lote"]??""),galpao:String(r.Galp??""),tecnico:String(r["Técnico"]??""),linhagem:String(r.Linhagem??""),tipo_granja:String(r["Tipo Granja"]??""),idade_atual:idade,aves_alojadas:aloj,aves_atuais:atual,mortes_acumuladas:mortes,mortalidade:aloj?mortes/aloj*100:null,peso_atual:peso});
        }
        rows.sort((a,b)=>b.idade_atual-a.idade_atual||a.granja.localeCompare(b.granja,"pt-BR"));
        cache.lotes={gerado:true,data_analise:ymd(latest),lotes:rows}; return cache.lotes;
    }

    function lotesMatch(row, filters={}, exclude=null){
        for(const key of Object.keys(LOTES_DIM)){
            if(key===exclude)continue; const selected=list(filters[key]); const field=key==="tipo_granja"?"tipo_granja":key; if(selected.length&&!selected.includes(String(row[field]??"")))return false;
        }
        if(exclude!=="faixa_idade"){
            const ranges=list(filters.faixa_idade); if(ranges.length&&!ranges.some(k=>FAIXAS[k]&&row.idade_atual>=FAIXAS[k][0]&&row.idade_atual<=FAIXAS[k][1]))return false;
        }
        return true;
    }

    async function filtrosLotes(filters){const d=await lotesData();const out={};for(const key of Object.keys(LOTES_DIM)){out[key]=[...new Set(d.lotes.filter(r=>lotesMatch(r,filters,key)).map(r=>String(r[key==="tipo_granja"?"tipo_granja":key]||"").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));}const ages=d.lotes.filter(r=>lotesMatch(r,filters,"faixa_idade")).map(r=>r.idade_atual);const min=Math.min(...ages),max=Math.max(...ages);out.faixa_idade=Object.entries(FAIXAS).filter(([,v])=>ages.length&&v[1]>=min&&v[0]<=max).map(([k,v])=>({valor:k,nome:`${v[0]}–${v[1]} dias`}));return out;}

    // O gerador offline usa o mesmo SELECT e vínculo de técnicos da API.
    const RXP_DIM = { data: "data", destino: "destino", produtor: "produtor",
        tecnico: "tecnico", tipo_granja: "tipoGranja", modelo: "modelo" };

    /**
     * FÓRMULA: Status RxP
     * Classifica Dif Qtde RxP: negativa, positiva, zero; ausente não recebe status.
     * Passo a passo (pseudocódigo):
     *   status = sinal(difQtdeRxP)
     */
    function rxpStatus(row) {
        const value = n(row.difQtdeRxP);
        return value === null ? "" : value < 0 ? "negativa" : value > 0 ? "positiva" : "zero";
    }

    function matchRxp(row, filters = {}, exclude = null) {
        if (!asDate(row.data)) return false;
        for (const [key, field] of Object.entries(RXP_DIM)) {
            const selected = key === exclude ? [] : list(filters[key]);
            if (selected.length && !selected.includes(String(row[field] ?? ""))) return false;
        }
        const statuses = exclude === "status" ? [] : list(filters.status);
        return !statuses.length || statuses.includes(rxpStatus(row));
    }

    /**
     * FÓRMULA: Totais RxP da API local
     * Soma programada, real e difQtdeRxP separadamente; ausentes somam zero. Conta diferenças numéricas
     * não nulas e diferentes de zero. A diferença vem da origem, não é Real menos Programada.
     * Passo a passo (pseudocódigo):
     *   programada = soma(programada)
     *   real = soma(real)
     *   diferenca = soma(difQtdeRxP)
     *   registros = contar(difQtdeRxP válido e != 0)
     */
    async function rxpData(filters = {}) {
        const rows = requireLocalRows("RXP_ROWS", window.RXP_ROWS).filter(r => matchRxp(r, filters));
        const cards = rows.reduce((acc, r) => {
            acc.programada += n(r.programada) ?? 0;
            acc.real += n(r.real) ?? 0;
            acc.diferenca += n(r.difQtdeRxP) ?? 0;
            if (n(r.difQtdeRxP) !== null && n(r.difQtdeRxP) !== 0) acc.registrosComDiferenca++;
            return acc;
        }, {programada: 0, real: 0, diferenca: 0, registrosComDiferenca: 0});
        return {arquivo: window.RXP_ARQUIVO || "lotes_planejados_abate.parquet", rows, cards};
    }

    async function filtrosRxp(filters = {}) {
        const rows = requireLocalRows("RXP_ROWS", window.RXP_ROWS);
        const out = {};
        for (const [key, field] of Object.entries(RXP_DIM)) {
            out[key] = opcoesDisponiveis(key, rows, filters, matchRxp, r => r[field]);
            if (key === "data") out[key].reverse();
        }
        out.status = opcoesDisponiveis("status", rows, filters, matchRxp, rxpStatus);
        return out;
    }

    window.LocalParquet = { baseRows, lotesData, filtrosBase, desempenho, detalhes, filtrosLotes, rxpData, filtrosRxp };

    const remoteApiGet = window.apiGet;
    window.apiGet = async function(endpoint, params={}){
        try{
            if (typeof remoteApiGet === "function" && typeof APP_CONFIG !== "undefined" && APP_CONFIG.API_URL) {
                return remoteApiGet(endpoint, params);
            }
            if(endpoint.includes("/rxp/formulas")) return {metricas: requireLocalRows("FORMULAS_RXP", window.FORMULAS_RXP)};
            if(endpoint.includes("/rxp/filtros")) return filtrosRxp(params);
            if(endpoint.includes("/rxp")) return rxpData(params);
            if(endpoint.includes("lotes-em-criacao/formulas")) return {metricas: window.FORMULAS_LOTES || []};
            if(endpoint.includes("lotes-em-criacao/filtros")) return filtrosLotes(params);
            if(endpoint.includes("lotes-em-criacao")) return lotesData();
            if(endpoint.includes("/formulas")) return {metricas:(window.BI_METRIC_ORDER||[]).map(id=>window.METRICAS[id])};
            if(endpoint.includes("/filtros")) return filtrosBase(params);
            if(endpoint.includes("/desempenho")) return desempenho(params);
            if(endpoint.includes("/detalhes")) return detalhes(params);
            if(endpoint.includes("/info")) return {arquivo:"indice_zootecnico_base_dinamica_tratado.parquet",atualizado_em:"Dados locais"};
            throw new Error(`Endpoint local não implementado: ${endpoint}`);
        }catch(error){
            const message=String(error?.message||error);
            throw error;
        }
    };
})();
