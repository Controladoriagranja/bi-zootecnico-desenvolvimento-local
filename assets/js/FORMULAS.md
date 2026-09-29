# Mapa das fórmulas em assets/js

Documentação do código em 29/09/2026. As localizações abaixo indicam a declaração da função ou o bloco que executa a fórmula. No VS Code, use Ctrl+G para ir à linha, ou Ctrl+F pelo nome. As linhas são uma fotografia desta revisão; os nomes das funções são a referência estável.

Os blocos “Passo a passo” são pseudocódigo explicativo. Nenhuma regra de cálculo foi alterada nesta organização. Σ significa somar as linhas do contexto filtrado. null representa ausência de resultado, normalmente exibida como —.

## Fluxo dos cálculos

- Index e detalhamento → local-parquet.js → metricValue. O catálogo é metrics.js.
- Lotes → lotes.js. O catálogo de explicações é lotes-formulas.js.
- RxP → local-parquet.js/rxp.js. O catálogo é rxp-formulas.js.
- Os indicadores IEP, CA, CAC, GMD, Idade e percentuais vêm prontos em colunas: o JS agrega esses valores; não reconstrói as fórmulas zootécnicas de origem.

## Arquivos e responsabilidades

| Arquivo | Responsabilidade |
|---|---|
| [local-parquet.js](local-parquet.js) | Motor local: médias ponderadas do index/detalhes, somas RxP e rota alternativa de lotes. |
| [lotes.js](lotes.js) | Motor da tela Lotes: mortalidade, médias simples semanais, média geral e gráficos. |
| [metrics.js](metrics.js) | Catálogo dos indicadores do index/detalhes, expressões SQL e documentação DAX. |
| [lotes-formulas.js](lotes-formulas.js) | Textos das oito fórmulas de Lotes; os cálculos executáveis ficam em lotes.js. |
| [rxp-formulas.js](rxp-formulas.js) | Catálogo de fórmulas RxP; descreve também o vínculo de técnico produzido antes do JavaScript. |
| [rxp.js](rxp.js) | Totais e agrupamentos da tela RxP sobre registros já filtrados. |
| [diferenca-aves.js](diferenca-aves.js) | Protótipo com MOCK_ROWS: somas e contagens; não é o motor dos dados reais RxP. |
| [dashboard.js](dashboard.js) | Exibe resultados de desempenho e abre fórmulas; não calcula médias dos indicadores. |
| [detalhes.js](detalhes.js) | Exibe valor, rankings e evolução recebidos de detalhes; não recalcula médias. |
| [charts.js](charts.js) | Desenha rankings/evolução; cálculos de tamanho e layout não são fórmulas zootécnicas. |
| [formulas.js](formulas.js) | Monta a página de catálogos; não calcula indicadores. |
| [formula-ui.js](formula-ui.js) | Renderiza explicações e painéis; não calcula indicadores. |
| [filters.js](filters.js) | Gerencia seleção e contexto de filtros; não calcula indicadores. |
| [api.js](api.js) | Transporte HTTP; recebe resultados da API, sem fórmulas de indicadores. |
| [config.js](config.js) | Configuração de modo e endpoints, sem fórmulas de indicadores. |
| [sidebar.js](sidebar.js) | Navegação, sem fórmulas de indicadores. |
| [theme.js](theme.js) | Tema visual, sem fórmulas de indicadores. |

## Indicadores do index e detalhamento

| Indicador | Coluna | Operação em metricValue |
|---|---|---|
| IEP | IEP | Média ponderada por Aves Abatidas |
| CA | CA | Média ponderada por Aves Abatidas |
| CAC | CAC | Média ponderada por Aves Abatidas |
| GMD | GMD | Média ponderada por Aves Abatidas |
| Mortalidade | % Mortalidade | Média ponderada por Aves Abatidas |
| Idade | Idade | Média ponderada por Aves Abatidas |
| Peso Médio | Peso Médio | Média ponderada por Aves Abatidas |
| Vazio | Vazio | Média ponderada por Aves Abatidas após substituir < 7 ou > 18 por 14 |
| Morte no Transporte | % Mort. Transporte | Média ponderada por Aves Abatidas |
| Aves Abatidas | Aves Abatidas | Soma |

Exemplo de Vazio: linhas (6 dias, 100 aves) e (18 dias, 300 aves) resultam em (14 × 100 + 18 × 300) / 400 = 17 dias. O registro substituído participa tanto do numerador quanto do denominador.

Exemplo de peso geral de Lotes: médias semanais 100 e 300 resultam em (100 + 300) / 2 = 200, mesmo que cada semana tenha quantidades diferentes de lotes.

## Localização e explicação de cada cálculo

### local-parquet.js — Conversão numérica

Local: [local-parquet.js](local-parquet.js), linha **47**, trecho **`function n(value) {`**.

Converte números e textos numéricos; valores inválidos ou ausentes retornam null. É a base para decidir quais linhas entram nas médias.

```text
numero = converter(valor); se inválido: retornar null
```

### local-parquet.js — Contexto do desempenho

Local: [local-parquet.js](local-parquet.js), linha **88**, trecho **`function matchBase(row, filters = {}, exclude = null) {`**.

Aplica data de abate, ano a partir de 2023 e filtros de dimensões, mês e intervalo antes das agregações.

```text
linhas = base que atende datas e filtros
```

### local-parquet.js — Soma de aves e média ponderada

Local: [local-parquet.js](local-parquet.js), linha **136**, trecho **`function metricValue(rows, metricId) {`**.

Aves Abatidas: soma da coluna, ausentes contam zero. Demais indicadores: soma(valor × Aves Abatidas) / soma(Aves Abatidas) apenas dos pares numéricos válidos. Vazio < 7 ou > 18 vira 14 antes da multiplicação; esses registros continuam no denominador. Denominador zero retorna null. Percentuais já estão em %, sem multiplicar por 100.

```text
se aves_abatidas: retornar soma([Aves Abatidas])
numerador = 0; denominador = 0
para cada linha com valor e aves válidos:
  se indicador == vazio e (valor < 7 ou valor > 18): valor = 14
  numerador += valor * aves
  denominador += aves
retornar denominador != 0 ? numerador / denominador : null
```

### local-parquet.js — Mensal e total anual

Local: [local-parquet.js](local-parquet.js), linha **176**, trecho **`async function desempenho(filters) {`**.

Reaplica metricValue às linhas de cada mês e de cada ano. O total anual não é a média das médias mensais.

```text
para cada ano:
  total = metricValue(linhas do ano)
  para cada mês: mensal = metricValue(linhas do mês)
```

### local-parquet.js — Valor, ranking e evolução

Local: [local-parquet.js](local-parquet.js), linha **207**, trecho **`async function detalhes(filters) {`**.

Usa metricValue para o valor geral, grupos por Técnico/Produtor e meses. Rankings excluem valor null, ordenam decrescente e limitam a 20 grupos. Com o mesmo contexto, o valor coincide com o index.

```text
valor = metricValue(linhas filtradas)
ranking = metricValue(linhas de cada técnico ou produtor)
evolução = metricValue(linhas de cada ano/mês)
```

### local-parquet.js — Rota alternativa de lotes

Local: [local-parquet.js](local-parquet.js), linha **242**, trecho **`async function lotesData(){`**.

Não é o cálculo usado diretamente por lotes.html. Usa maior Data_Analise, última versão por Codigo Granja + Num Lote + Galp e idade 0..45 relativa à análise. Soma mortes e descartes de 7..42; aves atuais = máximo(iniciais - mortes - descartes, 0). Mortalidade desta rota usa somente mortes / iniciais × 100. Peso: primeiro não nulo de 42 até 7, depois Ps Pinto.

```text
idade = piso((Data_Analise - Data Recepcao) / 86400000)
aves_atuais = max(Aves Inicia - mortes - descartes, 0)
mortalidade = mortes / Aves Inicia * 100
```

### local-parquet.js — Status RxP

Local: [local-parquet.js](local-parquet.js), linha **290**, trecho **`function rxpStatus(row) {`**.

Classifica Dif Qtde RxP: negativa, positiva, zero; ausente não recebe status.

```text
status = sinal(difQtdeRxP)
```

### local-parquet.js — Totais RxP da API local

Local: [local-parquet.js](local-parquet.js), linha **315**, trecho **`async function rxpData(filters = {}) {`**.

Soma programada, real e difQtdeRxP separadamente; ausentes somam zero. Conta diferenças numéricas não nulas e diferentes de zero. A diferença vem da origem, não é Real menos Programada.

```text
programada = soma(programada)
real = soma(real)
diferenca = soma(difQtdeRxP)
registros = contar(difQtdeRxP válido e != 0)
```

### lotes.js — Deduplicação e idade

Local: [lotes.js](lotes.js), linha **92**, trecho **`function prepareRows() {`**.

Usa hoje e Data Recepcao para idade em dias inteiros. Mantém 0..45 inclusive. Chave: Codigo Granja + Num Lote + Galp + recepção; escolhe maior Periodo_Arquivo_Fim (última ocorrência em empate). Registros sem chave completa recebem identidade por índice.

```text
idade = piso((hoje - recepção) / 86400000)
base = última versão por chave, com 0 <= idade <= 45
```

### lotes.js — Mortes mais descartes de uma semana

Local: [lotes.js](lotes.js), linha **150**, trecho **`function mortalityAtWeek(row, week) {`**.

Soma Qtde Mort Sem-XX e Qtde Desc Sem-XX do lote. XX = 07, 14, 21, 28, 35 ou 42. Ausentes somam zero.

```text
retornar [Qtde Mort Sem-XX] + [Qtde Desc Sem-XX]
```

### lotes.js — Mortes mais descartes do período

Local: [lotes.js](lotes.js), linha **165**, trecho **`function mortalitySelected(row) {`**.

Soma mortalityAtWeek apenas das semanas disponíveis já atingidas pelo lote.

```text
total = 0
para semana disponível:
  se idade >= semana: total += mortalityAtWeek(lote, semana)
```

### lotes.js — Média simples da coluna semanal

Local: [lotes.js](lotes.js), linha **180**, trecho **`function weeklyWeightMean(rows, week) {`**.

Usa Peso Med.-XX de lotes com idade >= semana. Descarta null, mantém zero. Soma pesos / quantidade de pesos válidos. Sem valores retorna null.

```text
pesos = valores válidos de [Peso Med.-XX] com idade >= semana
retornar soma(pesos) / quantidade(pesos), ou null
```

### lotes.js — Peso Médio Geral

Local: [lotes.js](lotes.js), linha **200**, trecho **`function generalWeightMean(rows) {`**.

Regra atual: média simples das médias semanais válidas. Cada semana tem o mesmo peso independentemente do número de lotes. Não usa Ps Pinto, nem último peso por lote.

```text
medias = weeklyWeightMean(linhas, semana) para cada semana disponível
remover medias null
retornar soma(medias) / quantidade(medias), ou null
```

### lotes.js — Cards e total da tabela

Local: [lotes.js](lotes.js), linha **299**, trecho **`function totals(rows) {`**.

Conta lotes, soma Aves Inicia uma vez por lote e M+D das semanas elegíveis. Percentual = total M+D / total aves × 100; peso = generalWeightMean. Denominador zero retorna null.

```text
lotes = quantidade(linhas)
aves = soma(Aves Inicia)
mortes = soma(mortalitySelected(lote))
percentual = mortes / aves * 100
peso = generalWeightMean(linhas)
```

### lotes.js — Dados dos gráficos semanais

Local: [lotes.js](lotes.js), linha **353**, trecho **`function weeklyData(rows) {`**.

Em cada semana, soma M+D e Aves Inicia apenas dos lotes que atingiram a idade. Linha percentual = M+D / aves elegíveis × 100. Peso usa weeklyWeightMean. Remove pontos sem lotes ou sem mortes positivas e sem peso válido.

```text
elegiveis = linhas com idade >= semana
barra = soma(mortalityAtWeek(lote, semana))
linha = barra / soma(aves elegíveis) * 100
peso = weeklyWeightMean(linhas, semana)
```

### lotes.js — Curva de crescimento e peso inicial

Local: [lotes.js](lotes.js), linha **561**, trecho **`const growthPoints = [`**.

Dentro de renderCharts. Sem seleção específica, ponto zero = média simples dos Ps Pinto válidos. Pontos semanais vêm de weeklyData. Remove pesos null e não extrapola para 45 dias.

```text
se todas as semanas: ponto0 = soma(Ps Pinto válidos) / quantidade
pontos semanais = pesos de weeklyData
```

### lotes.js — Agrupamento da tabela

Local: [lotes.js](lotes.js), linha **645**, trecho **`function aggregateTable(rows) {`**.

Agrupa por tipo_granja + produtor + linhagem. Soma aves e M+D; recalcula percentual e generalWeightMean nas linhas de cada grupo. O rodapé usa totals de todas as linhas, não a média dos grupos.

```text
para cada grupo:
  aves = soma(aves)
  mortes = soma(mortalitySelected(lote))
  percentual = mortes / aves * 100
  peso = generalWeightMean(linhas do grupo)
```

### metrics.js — Conversão para SQL

Local: [metrics.js](metrics.js), linha **232**, trecho **`function sqlNumero(coluna) {`**.

Constrói expressão de conversão numérica de uma coluna. Não executa a consulta.

```text
expressão = conversão numérica SQL da coluna
```

### metrics.js — Expressões SQL dos indicadores

Local: [metrics.js](metrics.js), linha **263**, trecho **`function sqlMetrica(metricId) {`**.

Gerador auxiliar, sem chamadas nos demais JS atuais. Soma para aves; média ponderada para demais. Vazio usa CASE para substituir fora de 7..18 por 14 e excluir pares nulos. Para outros indicadores, o SQL soma todos os pesos no denominador, mesmo se o valor estiver nulo: difere do motor local nesses casos.

```text
aves: SUM(valor)
vazio: SUM(valor ajustado * peso dos pares válidos) / SUM(pesos dos pares válidos)
outros: SUM(valor * peso) / SUM(peso)
```

### metrics.js — Fórmulas finais e DAX exibido

Local: [metrics.js](metrics.js), linha **323**, trecho **`Object.values(METRICAS).forEach(metric => {`**.

Enriquece o catálogo e sobrescreve formula_exibicao/formula_dax iniciais. DAX é referência textual, não executado no navegador. Exclui pares ausentes e anos anteriores a 2023; aplica Vazio ajustado antes de ponderar.

```text
para indicador: gerar texto, colunas, passos e DAX de referência
```

### lotes-formulas.js — Catálogo de fórmulas de Lotes

Local: [lotes-formulas.js](lotes-formulas.js), linha **14**, trecho **`window.buildLotesFormulas = (selected = WEEKS, filtered = false) => {`**.

Gera textos dos cinco cards e três gráficos conforme semanas disponíveis. Não calcula os dados; aponta para as funções documentadas de lotes.js.

```text
retornar descrições de contagem, soma, M+D, percentual e médias
```

### rxp.js — Totais da tela RxP

Local: [rxp.js](rxp.js), linha **202**, trecho **`function totals(rows) {`**.

Soma propriedades numéricas programada, real e difQtdeRxP. Conta diferenças não nulas e não zero. Dados já chegam mapeados; null soma como zero em JavaScript.

```text
somar programada, real e difQtdeRxP separadamente
contar difQtdeRxP != null e != 0
```

### rxp.js — Totais por destino

Local: [rxp.js](rxp.js), linha **240**, trecho **`function groupByUnit(rows) {`**.

Agrupa registros por destino e chama totals para cada grupo; ordenação inicial pelo valor absoluto da diferença decrescente.

```text
agrupar por destino; calcular totals(registros do destino)
```

### diferenca-aves.js — Totais do protótipo

Local: [diferenca-aves.js](diferenca-aves.js), linha **127**, trecho **`function totals(rows) {`**.

Usa dados fixos MOCK_ROWS: soma programada, real e difQtdeRxP. Conta difQtdeRxP !== 0. Diferentemente de RxP real, esta versão não testa null na contagem.

```text
somar campos do mock; contar diferenças !== 0
```

### diferenca-aves.js — Agrupamento do protótipo

Local: [diferenca-aves.js](diferenca-aves.js), linha **164**, trecho **`function groupByUnit(rows) {`**.

Agrupa o mock por destino; totals por grupo; ordem por diferença absoluta decrescente.

```text
agrupar por destino; aplicar totals
```

## Catálogos e apresentação

- metrics.js: cada chave de METRICAS define coluna, unidade e casas decimais; o bloco Object.values(METRICAS) gera a descrição final.
- lotes-formulas.js: IDs lotes_criacao, aves_alojadas, mortalidade_qtde, mortalidade, peso_medio, mortalidade_semanal, peso_semanal e crescimento correspondem às funções acima.
- rxp-formulas.js: IDs programada, real, diferenca e registros correspondem às somas/contagem RxP. O ID tecnico descreve uma vinculação feita antes do JS; não há função de cálculo desse vínculo nesta pasta.
- dashboard.js: metricCard/renderDashboard exibem os resultados; abrirFormula exibe o catálogo. detalhes.js: render exibe valor e passa dados para gráficos.
- charts.js: ranking/evolution desenham dados recebidos. Cálculos de largura/altura, arredondamento visual e ordenação não alteram os indicadores.
- formulas.js e formula-ui.js montam textos, passos e painéis; filtros, tema, navegação, configuração e transporte não contêm fórmulas de indicadores.

## Cuidados de manutenção

- Mudar um texto em um catálogo não altera o cálculo. Atualize motor e explicação juntos quando uma regra mudar.
- A rota lotesData de local-parquet.js e a tela lotes.js têm regras diferentes documentadas acima. Não assumir equivalência.
- sqlMetrica é auxiliar; sua regra de nulos para indicadores diferentes de Vazio não é idêntica ao motor local.
- rxp-formulas.js pode ser regenerado pelo fluxo de atualização: preserve a documentação ao regenerar.

## Localização dos itens nos catálogos

Os itens definem nomes e colunas. Em metrics.js, as expressões finais são geradas pelo bloco Object.values(METRICAS), documentado acima.

| Arquivo | Indicador (ID) | Linha do item |
|---|---|---|
| [metrics.js](metrics.js) | iep | 7 |
| [metrics.js](metrics.js) | ca | 27 |
| [metrics.js](metrics.js) | cac | 47 |
| [metrics.js](metrics.js) | gmd | 67 |
| [metrics.js](metrics.js) | mortalidade | 87 |
| [metrics.js](metrics.js) | idade | 107 |
| [metrics.js](metrics.js) | peso_medio | 127 |
| [metrics.js](metrics.js) | vazio | 147 |
| [metrics.js](metrics.js) | morte_transporte | 176 |
| [metrics.js](metrics.js) | aves_abatidas | 198 |
| [lotes-formulas.js](lotes-formulas.js) | lotes_criacao | 29 |
| [lotes-formulas.js](lotes-formulas.js) | aves_alojadas | 33 |
| [lotes-formulas.js](lotes-formulas.js) | mortalidade_qtde | 36 |
| [lotes-formulas.js](lotes-formulas.js) | mortalidade | 39 |
| [lotes-formulas.js](lotes-formulas.js) | peso_medio | 43 |
| [lotes-formulas.js](lotes-formulas.js) | mortalidade_semanal | 54 |
| [lotes-formulas.js](lotes-formulas.js) | peso_semanal | 59 |
| [lotes-formulas.js](lotes-formulas.js) | crescimento | 63 |
| [rxp-formulas.js](rxp-formulas.js) | programada | 7 |
| [rxp-formulas.js](rxp-formulas.js) | real | 21 |
| [rxp-formulas.js](rxp-formulas.js) | diferenca | 35 |
| [rxp-formulas.js](rxp-formulas.js) | registros | 49 |
| [rxp-formulas.js](rxp-formulas.js) | tecnico | 63 |

## Filtro de idade atual (atualização)

Em lotes.js, AGE_RANGES e matchesAgeRange selecionam faixas inclusivas 0–7, 8–14, 15–21, 22–28, 29–35, 36–42 e 43–45. Seleções múltiplas unem as faixas sem duplicação. Todos os filtros de dimensões são combinados por interseção. Cards, gráficos e tabela recebem as mesmas linhas filtradas. Os cálculos usam as colunas semanais até 42 dias, somente quando o lote atingiu a semana; não existe coluna de 45 dias.
