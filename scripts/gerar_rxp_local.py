"""Exporta o mesmo SELECT do backend, sem exigir que a API esteja rodando."""
from pathlib import Path
import json
import sys
import duckdb

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from config import PARQUET_RXP, PARQUET_BASE_DINAMICA
from rxp_data import FORMULAS_RXP, load_table, select_rows


def preparar_rxp():
    with duckdb.connect(database=":memory:") as con:
        load_table(con, PARQUET_RXP, PARQUET_BASE_DINAMICA)
        rows = select_rows(con)
    content = "window.RXP_ROWS = " + json.dumps(rows, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + ";\n"
    content += "window.RXP_ARQUIVO = " + json.dumps(Path(PARQUET_RXP).name) + ";\n"
    formulas = "window.FORMULAS_RXP = " + json.dumps(FORMULAS_RXP, ensure_ascii=False, separators=(",", ":")) + ";\n"
    return [(ROOT / "data" / "rxp_local.js", content, len(rows)),
            (ROOT / "assets" / "js" / "rxp-formulas.js", formulas, len(FORMULAS_RXP))]


def main():
    for path, content, count in preparar_rxp():
        temp = path.with_suffix(path.suffix + ".tmp")
        try:
            temp.write_text(content, encoding="utf-8")
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)
        print(f"OK: {path.name} - {count} registros")


if __name__ == "__main__":
    main()
