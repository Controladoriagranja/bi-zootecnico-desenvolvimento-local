# Diferença de Aves Abatidas — RxP

## Como usar

O ZIP já contém os dados reais exportados. Extraia e abra `diferenca-aves-abatidas.html` ou acesse pela sidebar. O padrão entregue é offline (`APP_ENV = "offline"` em `assets/js/config.js`, API_URL vazia).

Depois de substituir os Parquets em `data/`, execute `atualizar_dados_local.bat` e recarregue com Ctrl+F5. Esse atualizador agora inclui RxP e o vínculo de técnicos. Para atualizar somente RxP: `py scripts/gerar_rxp_local.py`. Dependência do gerador RxP: `duckdb` (também consta em `backend/requirements.txt`). Não precisa iniciar FastAPI.

Para usar a API, configure `APP_ENV = "local"` (http://127.0.0.1:8001) ou atualize `API_URLS.tunnel` com a URL de produção e selecione `tunnel`. Inicie com `py -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8001`. RxP e seu catálogo de fórmulas passam a usar a API. A seleção por API_URL não migra as demais telas legadas que já carregavam dados locais diretamente.

O botão Atualizar refaz as consultas. Na API, as alterações nos Parquets são detectadas na próxima consulta, sem reiniciar o serviço; não existe conexão direta ao ERP. No offline, o botão relê o snapshot JavaScript carregado: após gerar novos arquivos, use Ctrl+F5.

## Arquitetura e contrato

- `backend/config.py`: `PARQUET_RXP = PROJECT_ROOT / "data" / "lotes_planejados_abate.parquet"`.
- `backend/rxp.py`: APIRouter `/api/zootecnico/rxp`, registrado em `main.py`, conexão DuckDB em memória e RLock. Assinatura de ambos os arquivos (caminho, mtime_ns e tamanho); transação mantém o cache íntegro se a recarga falhar.
- `backend/rxp_data.py`: SQL de leitura, vínculo e catálogo `FORMULAS_RXP`, importados pelo router e pelo gerador local. Nenhum arquivo Parquet é modificado.
- `scripts/gerar_rxp_local.py`: usa o mesmo SQL e exporta `window.RXP_ROWS` em `data/rxp_local.js`; gera também `assets/js/rxp-formulas.js` a partir do catálogo Python.
- `assets/js/local-parquet.js`: `rxpData`, `filtrosRxp`, filtros cruzados e rotas offline. Reutiliza `n`, `list` e `asDate`. Quando o cliente HTTP está carregado e API_URL é preenchida, delega ao cliente HTTP.
- `assets/js/rxp.js`: carrega dados e opções via apiGet, controla respostas fora de ordem, estados de erro/carregamento, cards, tabela por unidade e modal por produtor. O mesmo contrato atende aos dois modos.
- HTML: mantém app-shell/page-header/card, tokens e temas de app.css e sidebar.js. Fórmulas renderizadas por FormulaUI na tela e em formulas.html, com links ƒx nos cards.

Endpoints:

| GET | Resposta |
| --- | --- |
| `/api/zootecnico/rxp` | `{arquivo, rows, cards}` |
| `/api/zootecnico/rxp/filtros` | `{data, destino, produtor, tecnico, tipo_granja, modelo, status}` |
| `/api/zootecnico/rxp/formulas` | `{metricas: FORMULAS_RXP}` |

Filtros aceitam um valor ou parâmetros repetidos. As opções de cada filtro consideram os demais, excluindo a própria seleção. Combinações sem dados retornam lista vazia e cards zerados. A tela mantém as seleções explícitas até o usuário alterá-las ou limpar os filtros.

Cada linha: `data, codigo, destino, produtor, galpao, tipoGranja, lote, modelo, programada, real, difQtdeRxP, tecnico, tecnico_data, tecnico_vinculo`.

Cards: `programada, real, diferenca, registrosComDiferenca`. As três quantidades são lidas de `Qtde Programada`, `Qtde Real` e `Dif Qtde RxP`, convertidas para número e somadas. A diferença nunca é refeita por subtração. Diferença ausente permanece null e não entra como zero no filtro de status.

## Técnico mais recente

1. Identidade prioritária: `Código` do RxP ↔ `Cod Prod` da base dinâmica. Isso permite ligar nomes abreviados da origem.
2. Alternativa: nome exato, com caixa e espaços normalizados, apenas quando representa uma identidade única. Não há correspondência aproximada ou por prefixo.
3. Seleciona o registro com técnico preenchido e maior `Data de Abate` de todo o histórico disponível, antes de aplicar os filtros do RxP. Desempata por `Data_Analise`, `Periodo_Arquivo_Fim` e, em empate completo, nome do técnico em ordem alfabética.
4. O mesmo técnico atual é aplicado a todos os registros RxP do produtor, independentemente da data filtrada. `tecnico_data` informa a data do abate usado no vínculo; `tecnico_vinculo` identifica `codigo`, `nome_exato` ou `sem_vinculo`.
5. Sem identificação segura: `Sem técnico vinculado`. Esses registros continuam em todos os totais e podem ser isolados no filtro Técnico.

A base dinâmica anexada possui abates até 15/09/2026; RxP vai até 25/09/2026. O técnico é o último conhecido nessa base, não uma confirmação de atribuições posteriores a ela.

No arquivo recebido: 179 registros, 67 produtores, 166 registros vinculados por código e 13 sem vínculo (6 produtores):

| Código | Produtor na origem |
| --- | --- |
| 14917 | FLAVIO JOSE DE ABREU DAVID - G |
| 21590 | AGRO ALIMENTOS FERREIRA LTDA |
| 23149 | MARIA JOSE LEMOS DE FARIA E OU |
| 33742 | JOAO GABRIEL SOBRINHO E OUTRO( |
| 48289 | RAFAEL HENRIQUE DE OLIVEIRA GA |
| 884 | FERNANDO OTAVIO MORAIS |

Linhas sem data, produtor, galpão ou lote são descartadas para excluir totalizadores. As 179 linhas do Parquet recebido são válidas; nenhuma foi removida. O módulo preserva o nível de detalhe da origem, sem deduplicação arbitrária por produtor/lote.

## Verificação

`python tests/test_rxp.py`: igualdade integral API/offline em dez contextos (incluindo múltiplas seleções e vazio), opções e fórmulas; totais diretamente contra o Parquet; técnico/data de cada registro vinculado; recarga quando qualquer fonte muda; diferença propositalmente distinta de Real − Programada; tratamento de null e erro de arquivo inválido.

Totais do arquivo: programada 3.644.483; real 3.472.815; Dif Qtde RxP −171.668; 146 registros com diferença.

Smoke de interação DOM (`tests/rxp-ui.cjs`, requer jsdom e RXP_TEST_API apontando para a API): validou carregamento, valores dos cards, filtros encadeados, limpar, modal, fórmulas e falha de conexão; modos offline/API e temas light/dark. Validação de layout por screenshot não foi executada: o navegador não pôde ser instalado no ambiente. Tokens e CSS existentes foram preservados.
