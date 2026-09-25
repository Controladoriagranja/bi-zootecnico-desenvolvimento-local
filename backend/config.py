from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
PARQUET_BASE_DINAMICA = (
    PROJECT_ROOT / "data" / "indice_zootecnico_base_dinamica_tratado.parquet"
)

PARQUET_LOTES_ABERTOS = (
    PROJECT_ROOT / "data" / "indice_zootecnico_mortalidade_peso_lotes_abertos_tratado.parquet"
)

PARQUET_RXP = PROJECT_ROOT / "data" / "lotes_planejados_abate.parquet"
