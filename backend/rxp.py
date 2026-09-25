"""RxP: mesmo ciclo de cache DuckDB em memória dos módulos zootécnicos."""
from pathlib import Path
from threading import RLock
from typing import Optional

import duckdb
from fastapi import APIRouter, HTTPException, Query

from config import PARQUET_RXP, PARQUET_BASE_DINAMICA
from rxp_data import DIMENSOES, FORMULAS_RXP, load_table, select_rows, payload

router = APIRouter(prefix="/api/zootecnico/rxp", tags=["Diferença de Aves Abatidas"])
CACHE_TABLE = "rxp_cache"
_cache_lock = RLock()
_con = duckdb.connect(database=":memory:")
_signature = None


def _file_signature(path):
    stat = Path(path).stat()
    return str(Path(path).resolve()), stat.st_mtime_ns, stat.st_size


def _ensure_cache():
    global _signature
    with _cache_lock:
        try:
            # A troca da base dinâmica também invalida os vínculos de técnico.
            signature = (_file_signature(PARQUET_RXP), _file_signature(PARQUET_BASE_DINAMICA))
            if signature != _signature:
                load_table(_con, PARQUET_RXP, PARQUET_BASE_DINAMICA, CACHE_TABLE)
                _signature = signature
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Erro ao carregar dados RxP: {exc}") from exc


def _list(value):
    if value is None or value == "":
        return []
    return value if isinstance(value, (list, tuple)) else [value]


def _where(filters, exclude=None):
    conditions, params = [], []
    for key, column in DIMENSOES.items():
        values = _list(filters.get(key)) if key != exclude else []
        if values:
            conditions.append(f'CAST("{column}" AS VARCHAR) IN ({", ".join("?" for _ in values)})')
            params.extend(str(v) for v in values)
    if exclude != "status":
        expressions = {"negativa": '"Dif Qtde RxP" < 0', "positiva": '"Dif Qtde RxP" > 0', "zero": '"Dif Qtde RxP" = 0'}
        statuses = _list(filters.get("status"))
        if statuses:
            conditions.append("(" + " OR ".join(expressions.get(v, "FALSE") for v in statuses) + ")")
    return (" WHERE " + " AND ".join(conditions) if conditions else ""), params


@router.get("/formulas")
def formulas():
    return {"metricas": FORMULAS_RXP}


@router.get("/filtros")
def filtros(data: Optional[list[str]] = Query(None), destino: Optional[list[str]] = Query(None),
            produtor: Optional[list[str]] = Query(None), tecnico: Optional[list[str]] = Query(None),
            tipo_granja: Optional[list[str]] = Query(None), modelo: Optional[list[str]] = Query(None),
            status: Optional[list[str]] = Query(None)):
    filters = dict(data=data, destino=destino, produtor=produtor, tecnico=tecnico, tipo_granja=tipo_granja, modelo=modelo, status=status)
    with _cache_lock:
        _ensure_cache()
        response = {}
        for key, column in DIMENSOES.items():
            where, params = _where(filters, exclude=key)
            values = _con.execute(f'''SELECT DISTINCT CAST("{column}" AS VARCHAR) AS valor
                FROM {CACHE_TABLE} {where}
                {'AND' if where else 'WHERE'} "{column}" IS NOT NULL AND TRIM(CAST("{column}" AS VARCHAR)) <> ''
                ORDER BY valor {'DESC' if key == 'data' else 'ASC'}''', params).fetchall()
            response[key] = [r[0] for r in values]
        where, params = _where(filters, exclude="status")
        values = _con.execute(f'''SELECT DISTINCT CASE WHEN "Dif Qtde RxP" < 0 THEN 'negativa'
            WHEN "Dif Qtde RxP" > 0 THEN 'positiva' WHEN "Dif Qtde RxP" = 0 THEN 'zero' END
            FROM {CACHE_TABLE} {where}''', params).fetchall()
        response["status"] = sorted(r[0] for r in values if r[0])
        return response


@router.get("")
@router.get("/", include_in_schema=False)
def dados(data: Optional[list[str]] = Query(None), destino: Optional[list[str]] = Query(None),
          produtor: Optional[list[str]] = Query(None), tecnico: Optional[list[str]] = Query(None),
          tipo_granja: Optional[list[str]] = Query(None), modelo: Optional[list[str]] = Query(None),
          status: Optional[list[str]] = Query(None)):
    filters = dict(data=data, destino=destino, produtor=produtor, tecnico=tecnico, tipo_granja=tipo_granja, modelo=modelo, status=status)
    with _cache_lock:
        _ensure_cache()
        where, params = _where(filters)
        return payload(select_rows(_con, CACHE_TABLE, where, params), Path(PARQUET_RXP).name)
