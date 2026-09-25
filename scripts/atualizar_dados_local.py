"""Converte os Parquets locais nos arquivos JavaScript usados pelas páginas."""
from pathlib import Path
import sys

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BASE_COLUMNS = [
    "Produtor", "Tipo de Granja", "Modelo", "Técnico", "Galpão.1",
    "Linhagem", "Vazio", "Data de Abate", "Aves Abatidas",
    "% Mort. Transporte", "% Mortalidade", "Status Acerto", "Peso Médio",
    "Idade", "GMD", "CA", "CAC", "IEP", "CAC REF",
]
DATASETS = [
    ("indice_zootecnico_base_dinamica_tratado.parquet",
     "base_dinamica_local.js", "BASE_DINAMICA_ROWS", BASE_COLUMNS),
    ("indice_zootecnico_mortalidade_peso_lotes_abertos_tratado.parquet",
     "lotes_abertos_local.js", "LOTES_ABERTOS_ROWS", None),
]


def preparar_dados(pasta):
    preparados = []
    for entrada, saida, variavel, colunas in DATASETS:
        origem = pasta / entrada
        if not origem.is_file():
            raise FileNotFoundError(f"Copie o Parquet para: {origem}")
        df = pd.read_parquet(origem, columns=colunas)
        # Exporta o histórico completo. A janela e a seleção de lotes ficam na tela.
        conteudo = (
            f"window.{variavel} = "
            + df.to_json(orient="records", date_format="iso", force_ascii=False,
                         double_precision=15)
            + ";\n"
        )
        preparados.append((pasta / saida, conteudo, len(df)))
    return preparados


def main():
    # Valida os dois Parquets antes de substituir qualquer arquivo da tela.
    preparados = preparar_dados(ROOT / "data")
    for destino, conteudo, linhas in preparados:
        temporario = destino.with_suffix(destino.suffix + ".tmp")
        try:
            temporario.write_text(conteudo, encoding="utf-8")
            temporario.replace(destino)
        finally:
            temporario.unlink(missing_ok=True)
        print(f"OK: {destino.name} - {linhas} registros")
    print("Dados atualizados. Recarregue a pagina com Ctrl+F5.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError, ImportError) as erro:
        print(f"ERRO: {erro}", file=sys.stderr)
        raise SystemExit(1)
