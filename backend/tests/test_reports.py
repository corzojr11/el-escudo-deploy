from datetime import date

from routers import reports


def test_week_report_window_has_seven_days():
    start, end = reports._period_window("week", date(2026, 7, 18))
    assert start.isoformat() == "2026-07-12"
    assert end.isoformat() == "2026-07-18"


def test_month_report_window_has_thirty_days():
    start, end = reports._period_window("month", date(2026, 7, 18))
    assert (end - start).days == 29


def test_report_period_filter_accepts_timestamp_and_date():
    rows = [
        {"date": "2026-07-18"},
        {"timestamp": "2026-07-11T23:00:00+00:00"},
        {"date": "2026-07-01"},
    ]
    selected = reports._inside_period(rows, date(2026, 7, 12), date(2026, 7, 18), "date", "timestamp")
    assert len(selected) == 1
