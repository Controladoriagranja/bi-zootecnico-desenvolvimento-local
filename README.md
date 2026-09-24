# BI Zootécnico

> **Ambiente local (24/09/2026):** consulte [DOCUMENTACAO-DADOS-LOCAL.md](DOCUMENTACAO-DADOS-LOCAL.md) para configuração, comandos e testes atuais. Este checkout usa a porta **8001**, preservando o serviço existente na 8000. As seções abaixo documentam a configuração anterior; não orientam publicação nesta etapa.

Dashboard para acompanhar indicadores produtivos de aves, com comparação mensal por ano, detalhamento por produtor e técnico e catálogo de fórmulas. A interface usa HTML, CSS e JavaScript; a API usa FastAPI e DuckDB para consultar um arquivo Parquet.

Documentação revisada em 22/09/2026 a partir do código presente no diretório de trabalho. Os assets HTML usam o marcador de cache `v=7.5`; ele não representa uma versão fixada das dependências.

## Funcionalidades

- **Desempenho** (`index.html`): tabelas de 11 indicadores, valores mensais, totais por ano, ordenação e consulta de fórmulas.
- **Detalhamento** (`detalhes.html`): indicador selecionado, KPI, rankings de técnicos e produtores e evolução mensal.
- **Fórmulas** (`formulas.html`): definições, ponderação, DAX de referência e regras pendentes, consultados na API.
- Filtros dependentes com seleção múltipla e tema claro/escuro, persistido no navegador.

Na tela principal, os filtros são Ano, Mês, Status Acerto, Tipo de Granja, Modelo, Produtor, Técnico, Tipo de Linhagem e Linhagem. No detalhamento aparecem Ano, Mês, Indicador, Produtor, Técnico e Galpão; os demais filtros de contexto podem ser herdados pela URL.

## Arquitetura

```text
Navegador (arquivos estáticos, localmente ou no GitHub Pages)
  -> API_URL (FastAPI local ou URL HTTPS do Cloudflare Tunnel)
     -> DuckDB em memória
        -> arquivo Parquet acessível pela máquina da API
```

O navegador recebe JSON e não lê Parquet. Não há etapa de build, Node.js obrigatório ou banco SQL externo configurado. ECharts 5 e a fonte Geist são carregados por CDN.

O backend carrega todo o Parquet em uma tabela em memória no primeiro acesso a dados. Em acessos posteriores, compara tamanho e data de modificação do arquivo para decidir se recarrega. O cache pertence ao processo: múltiplos workers criam cópias independentes. As consultas à conexão compartilhada são protegidas por `RLock`.

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `index.html`, `detalhes.html`, `formulas.html` | Páginas da aplicação |
| `assets/css/app.css` | Layout, componentes e temas |
| `assets/js/config.js` | URL da API e endpoints |
| `assets/js/api.js` | Cliente HTTP; serializa listas como parâmetros repetidos |
| `assets/js/filters.js` | Controle dos filtros dependentes |
| `assets/js/dashboard.js` | Tabelas, ordenação e modal de fórmulas |
| `assets/js/detalhes.js`, `charts.js` | Contexto do detalhe e gráficos ECharts |
| `assets/js/metrics.js` | Ordem dos indicadores e catálogo local legado |
| `assets/js/formulas.js`, `theme.js` | Catálogo via API e alternância de tema |
| `backend/main.py` | Rotas, filtros SQL e cache DuckDB |
| `backend/metrics.py` | Definições dos indicadores e SQL de cálculo |
| `backend/config.py` | Caminho do Parquet |
| `backend/requirements.txt` | Dependências Python, atualmente sem versões fixadas |
| `tests/TEST_REPORT*.txt` | Relatórios históricos; não são testes executáveis |

## Executar localmente no Windows

Pré-requisitos: Python compatível com as dependências instaladas, navegador moderno e acesso de leitura ao Parquet. O código usa sintaxe de Python 3.10 ou superior; o repositório não define uma versão de Python validada nem fixa as versões dos pacotes.

### 1. Configurar os dados

Em [backend/config.py](backend/config.py), ajuste `PARQUET_BASE_DINAMICA` para o arquivo real:

```python
PARQUET_BASE_DINAMICA = Path(r"C:\dados\indice_zootecnico_base_dinamica_tratado.parquet")
```

A configuração atual aponta para um compartilhamento de rede da empresa. A conta que executa a API precisa conseguir ler esse caminho. O arquivo não acompanha o repositório. Não existe carregamento de `.env` no código atual.

### 2. Instalar e iniciar a API

Em PowerShell, a partir da raiz do projeto:

```powershell
python -m venv backend/.venv
./backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Set-Location backend
./.venv/Scripts/python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

Execute o Uvicorn dentro de `backend/`, pois os imports de `config` e `metrics` são locais. A ativação do ambiente virtual não é necessária com esses comandos.

- Saúde do processo: <http://127.0.0.1:8000/api/health>
- Documentação interativa: <http://127.0.0.1:8000/docs>
- Verificação de acesso aos dados: <http://127.0.0.1:8000/api/zootecnico/info>

O health check não verifica o Parquet. `/info` efetivamente tenta carregar os dados.

### 3. Configurar e servir a interface

Em [assets/js/config.js](assets/js/config.js), defina `APP_CONFIG.API_URL` como `http://127.0.0.1:8000` para uso local, sem acrescentar `/api`.

Em outro terminal, na raiz do projeto:

```powershell
python -m http.server 5500 --bind 127.0.0.1
```

Abra <http://127.0.0.1:5500/index.html>. Mantenha os dois terminais em execução. O servidor estático acima é para desenvolvimento local e serve a raiz inteira do repositório.

## Publicação e Cloudflare Tunnel

O frontend pode ser hospedado como arquivos estáticos. O artefato de publicação precisa apenas de `index.html`, `detalhes.html`, `formulas.html` e `assets/`. A hospedagem estática não executa o backend; mantenha a API em uma máquina com acesso ao Parquet.

Para uma demonstração, com `cloudflared` instalado e a API em execução:

```powershell
cloudflared tunnel --url http://127.0.0.1:8000
```

Copie a URL HTTPS gerada para `APP_CONFIG.API_URL` e publique a configuração atualizada junto dos arquivos estáticos. A URL temporária pode mudar ao reiniciar o túnel. A URL já gravada no projeto não foi verificada nesta revisão.

Quick Tunnels são destinados a desenvolvimento e testes, sem garantia de disponibilidade, conforme a [documentação da Cloudflare](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/trycloudflare/).

A API atual não implementa autenticação e permite CORS de qualquer origem. Expor o túnel permite consultar seus endpoints; CORS não é controle de acesso. Para uso restrito com dados empresariais, configure controle de acesso antes da publicação. Não inclua Parquet, ambiente virtual ou credenciais no artefato estático.

## Contrato dos dados e regras de cálculo

A coluna de calendário deve se chamar `Data Abate` ou `Data de Abate`, nessa ordem de preferência, e ser conversível para timestamp pelo DuckDB.

As dimensões usadas são `Status Acerto`, `Tipo de Granja`, `Modelo`, `Produtor`, `Técnico`, `Linhagem` e `Galpão.1`. Preserve acentos, espaços e o sufixo do galpão. Algumas dimensões ausentes produzem listas vazias, mas filtros sobre colunas inexistentes podem falhar.

| ID | Coluna do Parquet | Cálculo |
| --- | --- | --- |
| `iep` | `IEP` | Média ponderada |
| `ca` | `CA` | Média ponderada |
| `cac` | `CAC` | Média ponderada |
| `gmd` | `GMD` | Média ponderada |
| `mortalidade` | `% Mortalidade` | Média ponderada |
| `idade` | `Idade` | Média ponderada |
| `peso_medio` | `Peso Médio` | Média ponderada |
| `vazio` | `Vazio` | Média ponderada |
| `morte_transporte` | `% Mort. Transporte` | Média ponderada |
| `cac_ref` | `CAC REF` | Média ponderada |
| `aves_abatidas` | `Aves Abatidas` | Soma |

Todas as médias usam `SUM(valor × Aves Abatidas) / SUM(Aves Abatidas)`. Denominador zero resulta em `null`. Valores numéricos são convertidos para DOUBLE, com tentativa adicional de conversão de decimal com vírgula. Valores inválidos tornam-se nulos; o peso de uma linha com métrica nula ainda pode entrar no denominador. Os totais anuais são recalculados sobre os registros filtrados, não pela média simples dos meses.

Regras atuais:

- Apenas registros com ano de abate **a partir de 2023** entram nos filtros e cálculos. Datas nulas ou não conversíveis são excluídas desse contexto.
- `/info` e `/cache` contam todos os registros carregados, inclusive anteriores a 2023.
- Seleções do mesmo filtro são combinadas com OR; filtros diferentes, com AND. Cada faceta ignora sua própria seleção ao calcular opções disponíveis.
- Linhagem não vazia contendo `/` é Mista; sem `/`, Pura.
- Rankings retornam até 20 técnicos/produtores em ordem numérica decrescente para qualquer indicador. Isso não significa “melhor desempenho” para métricas em que menor é melhor.
- O tratamento de Vazio abaixo de 7 ou acima de 18 está **pendente**; o código não aplica substituição ou corte.
- As fórmulas DAX são referências exibidas ao usuário; o cálculo executado é SQL no backend.

## API

Todas as rotas abaixo usam GET.

| Rota | Resultado |
| --- | --- |
| `/api/health` | Saúde do processo, sem leitura dos dados |
| `/api/zootecnico/info` | Arquivo, atualização, quantidade de registros e coluna de calendário |
| `/api/zootecnico/cache` | Estado do cache, carga, registros e quantidade de colunas |
| `/api/zootecnico/formulas` | Catálogo de métricas, sem depender do Parquet |
| `/api/zootecnico/filtros` | Opções dos filtros no contexto atual |
| `/api/zootecnico/desempenho` | Séries mensais e totais anuais dos indicadores |
| `/api/zootecnico/detalhes` | KPI, rankings e evolução de um `indicador` obrigatório |

Filtros comuns: `status_acerto`, `tipo_granja`, `modelo`, `produtor`, `tecnico`, `tipo_linhagem` (`pura`/`mista`), `linhagem`, `ano` e `mes` (1 a 12). `galpao` é aceito em `/filtros` e `/detalhes`, mas não em `/desempenho`.

Use parâmetros repetidos para múltiplas seleções:

```text
/api/zootecnico/desempenho?ano=2024&ano=2025&mes=1&mes=2
/api/zootecnico/detalhes?indicador=iep&ano=2025&tipo_linhagem=pura
```

As três rotas de consulta também aceitam `data_inicio` e `data_fim` no formato `AAAA-MM-DD`, com limites inclusivos. Os HTML atuais não exibem campos De/Até. As datas chegam ao backend como strings, sem validação explícita de formato ou de intervalo invertido.

## Validação e diagnóstico

Não há suíte automatizada executável nem configuração de CI no repositório. Os arquivos em `tests/` registram verificações de versões anteriores e não comprovam o funcionamento do checkout atual.

Roteiro manual depois de iniciar a aplicação:

1. Consulte `/api/health`, `/api/zootecnico/formulas` e `/api/zootecnico/info`.
2. Confira as 11 métricas e compare uma média ponderada com uma amostra conhecida.
3. Selecione múltiplos anos/meses e confirme os filtros dependentes e a exclusão de anos anteriores a 2023.
4. Abra um detalhe e confira contexto herdado, KPI, rankings e evolução.
5. Abra Fórmulas e alterne o tema.

| Sintoma | Verificação |
| --- | --- |
| Não foi possível conectar à API | Processo Uvicorn, `API_URL`, conectividade e túnel, se utilizado |
| Health responde, mas os dados falham | Caminho, permissões de rede e esquema do Parquet |
| Coluna de métrica/calendário não encontrada | Nomes exatos das colunas exigidas |
| Gráficos ausentes | Carregamento de ECharts pelo CDN e console do navegador |
| Dados inesperados ou vazios | Filtros, regra de 2023, conversão das datas e tipos numéricos |
| Interface antiga após publicação | Arquivos publicados e marcador `?v=` dos assets |

Nesta revisão documental, os contratos foram conferidos por leitura do código. Não foram executados testes funcionais contra o Parquet empresarial nem o túnel.

## Itens obsoletos e pendências

| Item | Diagnóstico e encaminhamento |
| --- | --- |
| README antigo V6.3/V7.2 | Substituído por este guia. A menção a Hyparquet 1.31.1 não corresponde à arquitetura atual; não há import dessa biblioteca. |
| `README.txt` V5.2 e `INSTRUCOES.txt` | Mantidos como histórico e sinalizados. Referem-se a versões, URLs, `teste.parquet` e pastas `github-pages/` e `api-local/` que não representam a estrutura atual. |
| `sqlNumero` e `sqlMetrica` em `assets/js/metrics.js` | Sem chamadas externas identificadas; resquícios do cálculo no navegador. O catálogo local `METRICAS` só é referenciado pelo gerador SQL legado. A constante `BI_METRIC_ORDER` continua em uso: não remover o arquivo inteiro. |
| `APP_CONFIG.mode` | Declarado como `api-tunnel`, mas não consultado pelo código atual. Não seleciona outro modo de execução. |
| Lógica De/Até em `dashboard.js` | Referencia `dataInicio`/`dataFim`, ausentes do HTML atual; candidata a limpeza. Os parâmetros de datas na API continuam implementados. |
| `pandas` e `pyarrow` | Listados em requirements, sem imports ou uso direto identificados no backend. Candidatos à remoção após validar instalação e consultas em ambiente limpo; DuckDB lê o Parquet diretamente. |
| ECharts `@5` | Versão principal anterior à 6, que possui [guia oficial de migração](https://echarts.apache.org/handbook/en/basics/release-note/v6-upgrade-guide/). Avaliar a migração com conferência visual; isso não demonstra, por si só, falha ou fim de suporte da versão 5. |
| Dependências sem versões fixadas | Python sem lockfile; ECharts fixa apenas a versão principal e Geist não fixa versão. Não é possível determinar pelo repositório quais versões Python estão instaladas ou desatualizadas. |
| Quick Tunnel | Configuração temporária de demonstração, não comprovação de endpoint ativo ou implantação estável. |
| Relatórios em `tests/` | Evidência histórica, não substituem testes reproduzíveis. |

Esta atualização altera apenas documentação; dependências, configuração e código legado não foram removidos.
