(() => {
  const WEEKS = [7, 14, 21, 28, 35, 42];
  window.buildLotesFormulas = (selected = WEEKS, filtered = false) => {
    const weeks = WEEKS.filter(week => selected.includes(week));
    const suffix = week => String(week).padStart(2, "0");
    const mortalityColumns = weeks.flatMap(week => ["Qtde Mort Sem-" + suffix(week), "Qtde Desc Sem-" + suffix(week)]);
    const weightColumns = weeks.map(week => "Peso Med.-" + suffix(week));
    const terms = weeks.map(week => `[Qtde Mort Sem-${suffix(week)}] + [Qtde Desc Sem-${suffix(week)}]`);
    const period = "Σ por lote (" + terms.join(" + ") + ")";
    const context = "Considera todos os filtros ativos da tela: Período de Dias, Tipo de Granja, Produtor, Modelo, Galpão, Técnico e Mist Linha. A base usa somente lotes abertos com Data Recepcao nos últimos 45 dias; cada Codigo Granja + Num Lote + Galp + Data Recepcao aparece uma vez, na versão mais recente por Periodo_Arquivo_Fim.";
    const eligibility = "Para cada semana, use somente lotes que já atingiram essa idade. Com semanas específicas selecionadas, entram lotes que atingiram pelo menos uma delas.";
    const weeklyMeanLabels = weeks.map(week => `Média([Peso Med.-${suffix(week)}])`);
    const generalWeightFormula = weeklyMeanLabels.length
      ? `(${weeklyMeanLabels.join(" + ")}) / quantidade de médias semanais válidas`
      : "—";

    return [
      { id: "lotes_criacao", nome: "Lotes em Criação",
        formula_exibicao: "Contagem de combinações únicas de [Codigo Granja] + [Num Lote] + [Galp] + [Data Recepcao]",
        colunas: ["Codigo Granja", "Num Lote", "Galp", "Data Recepcao", "Periodo_Arquivo_Fim"],
        descricao: context, passos: ["Mantenha a versão mais recente de cada lote/galpão.", "Aplique a janela de 45 dias e os filtros selecionados.", eligibility, "Conte os lotes resultantes."] },
      { id: "aves_alojadas", nome: "Aves Alojadas", formula_exibicao: "Σ([Aves Inicia])",
        colunas: ["Aves Inicia"], descricao: context,
        passos: ["Use os mesmos lotes do card Lotes em Criação.", "Some a coluna [Aves Inicia] uma única vez por lote, mesmo ao selecionar várias semanas."] },
      { id: "mortalidade_qtde", nome: "Mortalidade no Período (Qtde)", formula_exibicao: period,
        colunas: mortalityColumns, descricao: "Mortes + descartes somente das semanas selecionadas: " + weeks.join(", ") + " dias.",
        passos: [eligibility, "Em cada lote, some as colunas de mortes e descartes das semanas marcadas que o lote já atingiu.", "Some os resultados dos lotes. Campos vazios de mortes/descartes contam como zero."] },
      { id: "mortalidade", nome: "Mortalidade no Período (%)",
        formula_exibicao: "(" + period + " / Σ([Aves Inicia])) × 100",
        colunas: [...mortalityColumns, "Aves Inicia"], descricao: "Percentual do card e da tabela; utiliza a quantidade de mortes + descartes calculada acima.",
        passos: ["Some mortes + descartes das semanas selecionadas, respeitando a idade de cada lote.", "Divida pela soma de [Aves Inicia] dos lotes filtrados, contada apenas uma vez.", "Multiplique por 100. Se a soma de aves for zero, mostre —."] },
      { id: "peso_medio", nome: "Peso Médio Geral",
        formula_exibicao: generalWeightFormula,
        colunas: weightColumns,
        descricao: "Primeiro calcula a média simples de cada coluna semanal de peso no contexto filtrado. Depois soma as médias semanais válidas e divide pela quantidade de semanas com média disponível. Cada semana tem o mesmo peso no resultado geral, independentemente da quantidade de lotes daquela semana.",
        passos: [
          context,
          "Para cada semana selecionada, mantenha somente lotes que já atingiram essa idade.",
          "Calcule separadamente a média dos valores válidos da coluna correspondente: por exemplo, 7 dias usa [Peso Med.-07] e 35 dias usa [Peso Med.-35].",
          "Se uma semana não tiver nenhum peso válido, ela não entra no numerador nem na quantidade de semanas.",
          "Some as médias semanais válidas e divida pela quantidade de médias semanais válidas. Não use Ps Pinto neste indicador."
        ] },
      { id: "mortalidade_semanal", nome: "Mortalidade Semanal",
        formula_exibicao: weeks.map(week => `${week} dias: Σ([Qtde Mort Sem-${suffix(week)}] + [Qtde Desc Sem-${suffix(week)}]) / Σ([Aves Inicia]) × 100`).join("\n"),
        colunas: [...mortalityColumns, "Aves Inicia", "Data Recepcao"],
        descricao: "Cada barra mostra a quantidade M + D da semana. Cada ponto da linha mostra o percentual dessa mesma semana.",
        passos: ["Aplique todos os filtros ativos da tela.", "Para cada semana, selecione somente lotes que atingiram a idade correspondente.", "Some mortes + descartes da coluna dessa semana para obter a barra.", "Divida pelas aves iniciais desses mesmos lotes e multiplique por 100 para obter a linha. O denominador pode variar de uma semana para outra."] },
      { id: "peso_semanal", nome: "Média da Coluna de Peso por Idade",
        formula_exibicao: weeks.map(week => `${week} dias: Σ([Peso Med.-${suffix(week)}]) / quantidade de valores válidos em [Peso Med.-${suffix(week)}]`).join("\n"),
        colunas: weightColumns, descricao: "Cada idade é calculada separadamente. Ex.: 28 dias = média dos valores válidos da coluna [Peso Med.-28]; 35 dias = média dos valores válidos de [Peso Med.-35]. Todos os filtros ativos da tela são aplicados antes do cálculo.",
        passos: ["Aplique todos os filtros ativos da tela.", "Considere lotes que já atingiram a semana.", "Some os valores válidos da coluna correspondente e divida pela quantidade desses valores.", "Ignore campos vazios; zero preenchido continua sendo um valor."] },
      { id: "crescimento", nome: "Curva de Crescimento de Peso",
        formula_exibicao: "Cada ponto semanal usa a média da coluna correspondente: " + weightColumns.map(column => "[" + column + "]").join(", ") + ".",
        colunas: [...weightColumns, ...(!filtered ? ["Ps Pinto"] : [])],
        descricao: filtered ? "Mostra somente as semanas selecionadas com peso disponível, após aplicar todos os filtros da tela." : "O ponto 0 é Σ([Ps Pinto]) / quantidade de valores válidos de [Ps Pinto]. Os demais pontos usam as médias semanais após aplicar todos os filtros da tela.",
        passos: ["Aplique todos os filtros ativos da tela.", "Calcule cada ponto semanal como no gráfico Média da Coluna de Peso por Idade.", "Mostre somente pontos com peso válido. Não projete um peso para 45 dias, pois não existe essa coluna."] }
    ];
  };
  window.FORMULAS_LOTES = window.buildLotesFormulas();
})();
