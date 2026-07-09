"""Tests unitarios para el motor de ritmos biológicos (bio.py)."""

from datetime import datetime
from unittest.mock import patch


def test_calcular_anclajes_bio_horarios():
    """Verifica que los anclajes se calculan con los offsets correctos."""
    with patch("bio.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)

        from bio import calcular_anclajes_bio

        anclajes = calcular_anclajes_bio(6, 0)

    assert len(anclajes) == 3
    assert anclajes[0]["anchor"] == "Luz Solar"
    assert anclajes[0]["time"] == "06:30"
    assert anclajes[1]["anchor"] == "Almuerzo"
    assert anclajes[1]["time"] == "10:30"
    assert anclajes[2]["anchor"] == "Ducha Térmica"
    assert anclajes[2]["time"] == "21:30"


def test_calcular_ventanas_sueno_orden():
    """Verifica que las ventanas de sueño se ordenan de más a menos ciclos."""
    with patch("bio.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)

        from bio import calcular_ventanas_sueno

        ventanas = calcular_ventanas_sueno(6, 0)

    assert len(ventanas) == 3
    assert ventanas[0]["cycles"] == 6
    assert ventanas[1]["cycles"] == 5
    assert ventanas[2]["cycles"] == 4


def test_calcular_ventanas_sueno_horas():
    """Verifica que cada ventana tiene el campo 'hours' correcto."""
    with patch("bio.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)

        from bio import calcular_ventanas_sueno

        ventanas = calcular_ventanas_sueno(6, 0)

    expected = {6: 9.0, 5: 7.5, 4: 6.0}
    for v in ventanas:
        assert v["hours"] == expected[v["cycles"]]


def test_calcular_anclajes_bio_tipos():
    """Verifica que los anclajes contienen los campos esperados."""
    with patch("bio.datetime") as mock_dt:
        mock_dt.now.return_value = datetime(2025, 6, 1, 6, 0, 0)

        from bio import calcular_anclajes_bio

        anclajes = calcular_anclajes_bio(6, 0)

    for a in anclajes:
        assert "anchor" in a
        assert "title" in a
        assert "description" in a
        assert "time" in a
        assert isinstance(a["anchor"], str)
        assert isinstance(a["title"], str)
        assert isinstance(a["time"], str)
