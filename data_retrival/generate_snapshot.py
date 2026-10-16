#!/usr/bin/env python3
"""Gera o snapshot estatico (src/data/snapshot.json) a partir do backend lol_back.

Por que ler do backend e nao do Mongo direto: o backend ja serializa os dados no
shape exato que o frontend consome (api.js). Reproduzir essa serializacao em
Python duplicaria logica que vive no Express e divergiria com o tempo. Entao o
snapshot e um retrato fiel das rotas publicas, gerado quando voce re-semeia.

Uso:
    python data_retrival/generate_snapshot.py [BASE_URL]

BASE_URL default: a URL de producao do Render. Rode DEPOIS de popular o banco
(setup_database.py) para o snapshot refletir os dados atuais.
"""
import json
import os
import sys
import urllib.request

DEFAULT_BASE = "https://lol-back-6zld.onrender.com"
OUT_PATH = os.path.join(os.path.dirname(__file__), "..", "src", "data", "snapshot.json")


def fetch(url):
    with urllib.request.urlopen(url, timeout=90) as resp:
        return json.loads(resp.read().decode("utf-8"))


def strip_id(doc):
    """Remove o _id do Mongo: o frontend nao usa e so engorda o snapshot."""
    if isinstance(doc, dict):
        doc.pop("_id", None)
    return doc


def build_snapshot(base):
    """Le o backend e RETORNA o dict do snapshot (sem gravar em disco)."""
    nationalities = [strip_id(n) for n in fetch(f"{base}/nationality/")]
    print(f"  nacionalidades: {len(nationalities)}")

    champions_by_region = {}
    for nat in nationalities:
        slug = nat["slug"]
        champs = [strip_id(c) for c in fetch(f"{base}/nationality/champions/{slug}")]
        champions_by_region[slug] = champs
        print(f"  {slug}: {len(champs)} campeoes")

    return {
        "nationalities": nationalities,
        "championsByRegion": champions_by_region,
    }


def main():
    base = (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_BASE).rstrip("/")
    print(f"Lendo do backend: {base}")

    snapshot = build_snapshot(base)

    # Guarda-chuva: NUNCA sobrescrever o snapshot com dados vazios. O snapshot e
    # o que abre a home instantaneamente; gravar vazio (banco vazio / backend
    # fora do ar) quebraria o site. Melhor abortar e manter o snapshot atual.
    if not snapshot["nationalities"]:
        raise SystemExit(
            "Erro: o backend devolveu nenhuma nacionalidade; "
            "snapshot NAO foi sobrescrito (o banco pode estar vazio)."
        )

    out = os.path.normpath(OUT_PATH)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, ensure_ascii=False, indent=0, separators=(",", ":"))
    size_kb = os.path.getsize(out) / 1024
    print(f"Snapshot gravado em {out} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
