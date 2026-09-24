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
        galpao: "Galpão.1"
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

    function matchBase(row, filters = {}, exclude = null) {
        const d = asDate(row["Data de Abate"] ?? row["Data Abate"]);
        if (!d || d.getFullYear() < 2023) return false;

        for (const [key, col] of Object.entries(DIM)) {
            if (key === exclude) continue;
            const selected = list(filters[key]);
            if (selected.length && !selected.includes(String(row[col] ?? ""))) return false;
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

    function metricValue(rows, metricId) {
        const metric = window.METRICAS?.[metricId];
        if (!metric) return null;
        if (metricId === "aves_abatidas") {
            return rows.reduce((sum, row) => sum + (n(row[metric.coluna]) || 0), 0);
        }
        let num = 0, den = 0;
        rows.forEach(row => {
            const value = n(row[metric.coluna]);
            const weight = n(row["Aves Abatidas"]);
            if (value === null || weight === null) return;
            if (metricId === "vazio" && (value < 7 || value > 18)) return;
            num += value * weight;
            den += weight;
        });
        return den ? num / den : null;
    }

    async function filtrosBase(filters) {
        const rows = await baseRows();
        const out = {};
        for (const [key, col] of Object.entries(DIM)) {
            const vals = [...new Set(rows.filter(r => matchBase(r, filters, key)).map(r => String(r[col] ?? "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
            out[key] = vals;
        }
        out.tipo_linhagem = [...new Set(rows.filter(r => matchBase(r, filters, "tipo_linhagem")).map(rowTypeLinhagem).filter(Boolean))].sort().map(v => ({valor:v,nome:v === "mista" ? "Mista" : "Pura"}));
        out.ano = [...new Set(rows.filter(r => matchBase(r, filters, "ano")).map(r => asDate(r["Data de Abate"] ?? r["Data Abate"])?.getFullYear()).filter(y => y >= 2023))].sort((a,b)=>b-a);
        out.mes = [...new Set(rows.filter(r => matchBase(r, filters, "mes")).map(r => (asDate(r["Data de Abate"] ?? r["Data Abate"])?.getMonth() ?? -1)+1).filter(m => m>=1))].sort((a,b)=>a-b).map(m=>({valor:m,nome:MESES[m-1]}));
        return out;
    }

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

    window.LocalParquet = { baseRows, lotesData, filtrosBase, desempenho, detalhes, filtrosLotes };

    window.apiGet = async function(endpoint, params={}){
        try{
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
