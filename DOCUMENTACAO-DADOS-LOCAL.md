# Dados locais — BI Zootécnico

Ambiente de desenvolvimento local, preservando interface, arquitetura e contrato existentes.
Nenhuma publicação, deploy, alteração do GitHub Pages ou configuração do Cloudflare foi realizada.

## Iniciar API e frontend

A porta **8001** foi escolhida porque existe outra API na 8000, que o usuário solicitou manter.
`assets/js/config.js` define `APP_ENV = "local"` e `API_URLS.local = "http://127.0.0.1:8001"`.

Terminal 1, na raiz:

```powershell
cd backend
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Terminal 2, na raiz:

```powershell
python -m http.server 5500
```

Abra http://127.0.0.1:5500/ ou http://127.0.0.1:5500/index.html. Não usar `file://`.
**Nesta máquina, use `py` no lugar de `python`**, pois `python` aponta para o atalho da Microsoft Store. O Python instalado e as dependências foram validados usando `py`.
Em uma instalação nova, prepare previamente as dependências com `py -m pip install -r backend/requirements.txt`.
Não houve instalação de framework pesado: os testes usam unittest e o Selenium/Chrome/ChromeDriver existentes.

Para futuramente usar 8000, libere a porta, altere `API_URLS.local` para `http://127.0.0.1:8000` e inicie Uvicorn com `--port 8000`.
O CORS existente (`allow_origins=["*"]`, sem credenciais) permite o frontend em `http://127.0.0.1:5500`; isso foi testado por HTTP e navegador.

## Fonte e schema real

Arquivo: `data/indice_zootecnico_base_dinamica_tratado.parquet`.
`backend/config.py` calcula a raiz com `Path(__file__).resolve().parent.parent` e acrescenta `data` e o nome do arquivo. Compatível com Windows, independente do diretório de execução e sem caminhos absolutos ou de rede.
Os outros dois Parquets na pasta data não participam desta etapa.

**8.075 registros, 272 colunas. Período completo: 19/12/2022 a 15/09/2026.**
Anos pela data de abate: 2022, 2023, 2024, 2025 e 2026.
Schema integral, tipos, dimensões, campos de ano e comparação de campos necessários: [tests/PARQUET_SCHEMA_REPORT.txt](tests/PARQUET_SCHEMA_REPORT.txt).
**Nenhuma coluna necessária ausente; nenhum mapeamento novo necessário.**

Coluna calendário real: **Data de Abate (TIMESTAMP_NS)**. A detecção existente aceita primeiro Data Abate, depois Data de Abate.
Os campos Ano (Abate), Ano (Aloj), Ano_Analise e AnoMes_Analise não substituem esse calendário.

| Dimensão da API | Coluna física | Tipo |
| --- | --- | --- |
| produtor | Produtor | VARCHAR |
| tecnico | Técnico | VARCHAR |
| galpao | Galpão.1 | VARCHAR |
| linhagem | Linhagem | VARCHAR |
| status_acerto | Status Acerto | VARCHAR |
| tipo_granja | Tipo de Granja | VARCHAR |
| modelo | Modelo | VARCHAR |

As colunas de indicadores são DOUBLE, exceto Vazio, que é VARCHAR. `sql_numero()` já aceita conversão numérica tolerante e decimal com vírgula; foi preservado.

## Indicadores e fórmulas

A fonte oficial é `METRICAS` / `sql_metrica()` em backend/metrics.py. O SQL existente não foi alterado.
A descrição e o DAX de referência de Vazio foram alinhados à regra que o SQL já aplicava.

| ID estável | Coluna física | Fórmula |
| --- | --- | --- |
| `iep` | `IEP` | Σ(IEP × Aves Abatidas) / Σ(Aves Abatidas) |
| `ca` | `CA` | Σ(CA × Aves Abatidas) / Σ(Aves Abatidas) |
| `cac` | `CAC` | Σ(CAC × Aves Abatidas) / Σ(Aves Abatidas) |
| `gmd` | `GMD` | Σ(GMD × Aves Abatidas) / Σ(Aves Abatidas) |
| `mortalidade` | `% Mortalidade` | Σ(% Mortalidade × Aves Abatidas) / Σ(Aves Abatidas) |
| `idade` | `Idade` | Σ(Idade × Aves Abatidas) / Σ(Aves Abatidas) |
| `peso_medio` | `Peso Médio` | Σ(Peso Médio × Aves Abatidas) / Σ(Aves Abatidas) |
| `vazio` | `Vazio` | Σ(Vazio × Aves Abatidas) / Σ(Aves Abatidas), somente registros com 7 ≤ Vazio ≤ 18 |
| `morte_transporte` | `% Mort. Transporte` | Σ(% Mort. Transporte × Aves Abatidas) / Σ(Aves Abatidas) |
| `cac_ref` | `CAC REF` | Σ(CAC REF × Aves Abatidas) / Σ(Aves Abatidas) |
| `aves_abatidas` | `Aves Abatidas` | Σ(Aves Abatidas) |

Ponderador: **Aves Abatidas**. Aves Abatidas é soma, nunca média.

### Lotes em Criação — Peso Médio Geral

A métrica **Peso Médio Geral** da aba **Lotes em Criação** é diferente do `peso_medio` da aba Desempenho. Ela **não é ponderada por Aves Abatidas** e **não usa o último peso de cada lote**.

O cálculo é feito em duas etapas, sempre depois de aplicar todos os filtros ativos da tela (Período de Dias, Tipo de Granja, Produtor, Modelo, Galpão, Técnico e Mist Linha):

1. Para cada idade selecionada, calcule a média simples da coluna correspondente, usando somente lotes que já atingiram aquela idade e valores de peso válidos. Ex.: 7 dias usa `Peso Med.-07`; 35 dias usa `Peso Med.-35`.
2. Some as médias semanais válidas e divida pela quantidade de semanas que possuem média válida.

Exemplo conceitual, se as médias filtradas forem 180 g em 7 dias, 525 g em 14 dias e 1.050 g em 21 dias:

```text
Peso Médio Geral = (180 + 525 + 1.050) / 3 = 585 g
```

Se o filtro **Período de Dias** selecionar apenas 7 e 14 dias, o cálculo usa somente `Peso Med.-07` e `Peso Med.-14`. Se uma semana selecionada não tiver nenhum valor válido, ela não entra no numerador nem no divisor. `Ps Pinto` não participa do Peso Médio Geral.

O gráfico **Média da Coluna de Peso por Idade** mostra exatamente a primeira etapa do cálculo: uma média separada para cada coluna semanal. A tabela da aba aplica a mesma regra dentro de cada agrupamento exibido.
Vazio inclui somente **7 ≤ Vazio ≤ 18**, excluindo as demais linhas do numerador e denominador apenas desse indicador. Sem substituição ou interpolação.
A mesma função alimenta cards, tabelas, totais, rankings e evolução. Totais são recalculados sobre as linhas filtradas, não pela média dos meses.
Nas demais médias, permanece o comportamento oficial de pesos no denominador mesmo quando a métrica está nula; denominador zero gera null.

Regra global: **ano de abate >= 2023**, aplicada na API a opções, cálculos, rankings e evolução. O Parquet não foi alterado.
`/info` e `/cache` descrevem o arquivo completo, inclusive 2022; não representam indicadores filtrados.
Seleções do mesmo filtro usam OR; filtros diferentes usam AND. Listas chegam como parâmetros repetidos. As facetas ignoram sua própria seleção ao calcular opções, respeitando as demais.
Linhagem contendo `/` gera Mista; sem `/`, Pura. Nulos/vazios mantêm o comportamento existente de não aparecer nas opções. Não foi criada coluna física.

## Contrato e endpoints

Parquet local → DuckDB em memória → FastAPI → JSON → HTML atual.
O navegador não abre Parquet, não usa Hyparquet nem DuckDB-Wasm.
As adaptações de campos pertencem ao backend; o frontend consome IDs estáveis, como peso_medio.
O catálogo JS legado permanece por compatibilidade, com Vazio alinhado; seu SQL não é chamado pelas páginas. As fórmulas exibidas vêm de `/formulas`.

Base atual: **http://127.0.0.1:8001**. Todos os endpoints abaixo usam GET.

| Endpoint | Retorno |
| --- | --- |
| /api/health | Saúde do processo, sem ler Parquet |
| /api/zootecnico/info | arquivo, registros, atualizado_em, cache_carregado_em, coluna_calendario; adicionados ano_minimo, data_minima, data_maxima |
| /api/zootecnico/cache | Metadados do cache |
| /api/zootecnico/formulas | metricas: catálogo oficial |
| /api/zootecnico/filtros | Opções de dimensões, ano, mes, tipo_linhagem |
| /api/zootecnico/desempenho | anos, meses, indicadores[id].por_ano e .totais |
| /api/zootecnico/detalhes?indicador=iep | indicador.valor, rankings, evolucao, filtros |

Exemplos de parâmetros:

```text
/api/zootecnico/desempenho?ano=2025
/api/zootecnico/desempenho?ano=2025&ano=2026&mes=1&mes=2
/api/zootecnico/detalhes?indicador=vazio&tipo_linhagem=mista
```

A URL anterior `https://task-uses-vector-productivity.trycloudflare.com` permanece em `API_URLS.tunnel`, inativa no modo local. Nenhum túnel foi iniciado ou consultado.
ECharts **5.6.0** e Geist **5.3.0** estão em assets/vendor, com licenças, arquivos de fonte e manifesto de origem/SHA-256. As três páginas funcionam sem CDN ou internet depois deste preparo; o design foi preservado.

## Substituir o Parquet e trocar a origem futuramente

1. Prepare outro arquivo com as mesmas colunas e tipos compatíveis.
2. Pare a API e substitua somente data/indice_zootecnico_base_dinamica_tratado.parquet.
3. Execute os testes e regenere os relatórios; reinicie a API e confira /info.
4. Se faltar uma coluna, documente a esperada, candidatas e possível mapeamento antes de alterar queries. Não associe por adivinhação.

O cache recarrega ao detectar mudança de tamanho ou data de modificação. Reiniciar também cobre substituições com assinatura idêntica.
Para a extração oficial futura, altere a leitura/cache e adaptações de campos no backend, preservando fórmulas e contratos JSON. O HTML permanece consumindo os mesmos endpoints e IDs.

## Testes e evidências

Na raiz:

```powershell
py -B tests/run_checks.py --browser
py -B tests/report_local.py
py -B tests/browser_local.py
```

run_checks.py verifica sintaxe, 17 testes JavaScript e 19 testes Python (13 regressões sintéticas/HTTP e 6 sobre o arquivo real). Com --browser, inclui a regressão de seis tamanhos de tela.
Os testes reais validam todas as fórmulas com soma/ponderação independente em Python e DuckDB; comparam filtros simples, múltiplos, técnico real, Pura/Mista, totais, meses, rankings e evolução. Os sintéticos verificam as fronteiras de Vazio, nulos, valores inválidos e exclusão de 2022.

browser_local.py inicia os servidores reais em 8001/5500, testa as três páginas com configuração efetiva, CORS, filtros, métricas e console. Bloqueia HTTPS externo e confere que as requisições são locais e não solicitam Parquet. Encerra apenas os processos criados pelo teste; requer essas portas livres.
Relatório: [tests/BROWSER_LOCAL_REPORT.json](tests/BROWSER_LOCAL_REPORT.json).

Amostra real: **2026-09-09**, **3 registros**. Valores anteriores ao arredondamento da interface:

| Indicador | DuckDB | API |
| --- | --- | --- |
| aves_abatidas | 113556.0 | 113556.0 |
| iep | 364.75405843812746 | 364.75405843812746 |
| ca | 1.702278347247173 | 1.702278347247173 |
| vazio | 14.0 | 14.0 |

Linhas reais, pesos, SQL e parâmetros: [tests/LOCAL_VALUES_REPORT.json](tests/LOCAL_VALUES_REPORT.json).
A pasta tests já era ignorada pelo Git e foi mantida local, assim como os Parquets. Nenhum commit ou publicação foi feito.

Resultado final e lista de arquivos alterados/criados: [tests/TEST_REPORT_LOCAL.md](tests/TEST_REPORT_LOCAL.md). Todos os testes acima passaram.
