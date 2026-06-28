"""Email notification service for stock alerts."""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import pandas as pd

from app.config import get_settings

logger = logging.getLogger(__name__)

_DOWN = "consecutive_down_days"
_UP = "consecutive_up_days"
_PCT = "price_change_pct"

_DISCLAIMER = (
    "Questo alert non costituisce consulenza finanziaria. "
    "StockView è uno strumento di analisi personale."
)


def send_alert_email(
    symbol: str,
    kind: str,
    days: int | None,
    recipient_email: str,
    prices: pd.DataFrame,
    extra: dict | None = None,
) -> None:
    """Send an HTML alert email.

    For consecutive kinds, prices must have columns ['date', 'close'] sorted
    oldest→newest with at least days+1 rows.
    For price_change_pct, extra must contain ref_price, current_price,
    change_pct, threshold_pct, direction.
    If ALERT_EMAIL_SENDER is not configured, logs a warning and returns silently.
    """
    settings = get_settings()

    if not settings.alert_email_sender:
        logger.warning("ALERT_EMAIL_SENDER not configured — skipping email for %s", symbol)
        return

    if kind == _PCT:
        subject, html = _build_pct_email(symbol, extra or {})
    else:
        subject, html = _build_consecutive_email(symbol, kind, days, prices)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = settings.alert_email_sender
    msg["To"] = recipient_email
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
        smtp.ehlo()
        smtp.starttls()
        smtp.login(settings.alert_email_sender, settings.alert_email_password)
        smtp.sendmail(settings.alert_email_sender, recipient_email, msg.as_string())

    logger.info("Alert email sent for %s (%s) to %s", symbol, kind, recipient_email)


# ---------------------------------------------------------------------------
# Consecutive days email
# ---------------------------------------------------------------------------

def _build_consecutive_email(
    symbol: str, kind: str, days: int | None, prices: pd.DataFrame
) -> tuple[str, str]:
    is_up = kind == _UP
    direction_label = "in rialzo" if is_up else "in calo"
    icon = "📈" if is_up else "⚠️"
    header_color = "#16a34a" if is_up else "#dc2626"
    pct_color = "#16a34a" if is_up else "#dc2626"

    subject = f"{icon} Alert StockView — {symbol} {direction_label} da {days} giorni"

    first_close = prices.iloc[0]["close"]
    last_close = prices.iloc[-1]["close"]
    period_pct = ((last_close - first_close) / first_close) * 100

    rows = "".join(
        f"<tr>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #e2e8f0;'>{row['date']}</td>"
        f"<td style='padding:6px 12px;border-bottom:1px solid #e2e8f0;text-align:right;'>"
        f"{row['close']:.2f}</td>"
        f"</tr>"
        for _, row in prices.iterrows()
    )

    html = f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1e293b;background:#f8fafc;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;
              box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden;">
    <div style="background:{header_color};padding:16px 24px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">
        {icon} {symbol} {direction_label} da {days} giorni consecutivi
      </h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 16px;">
        Il titolo <strong>{symbol}</strong> ha registrato
        <strong>{days} chiusure consecutive {direction_label}</strong>.
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 12px;text-align:left;">Data</th>
            <th style="padding:6px 12px;text-align:right;">Chiusura</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
      <p style="margin:16px 0 0;font-size:15px;">
        Variazione periodo:
        <strong style="color:{pct_color};">{period_pct:+.2f}%</strong>
      </p>
      {_disclaimer_block()}
    </div>
  </div>
</body>
</html>"""
    return subject, html


# ---------------------------------------------------------------------------
# Price change % email
# ---------------------------------------------------------------------------

def _build_pct_email(symbol: str, extra: dict) -> tuple[str, str]:
    ref_price: float = extra.get("ref_price", 0.0)
    current_price: float = extra.get("current_price", 0.0)
    change_pct: float = extra.get("change_pct", 0.0)
    threshold_pct: float = extra.get("threshold_pct", 0.0)
    direction: str = extra.get("direction", "up")

    is_up = direction == "up"
    value_color = "#16a34a" if is_up else "#dc2626"
    header_color = "#7c3aed"  # violet — neutral, could go either way

    subject = (
        f"[StockView] {symbol} variato di {change_pct:+.2f}% "
        f"(soglia ±{threshold_pct:.0f}%)"
    )

    html = f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"></head>
<body style="font-family:sans-serif;color:#1e293b;background:#f8fafc;padding:24px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;
              box-shadow:0 1px 3px rgba(0,0,0,.1);overflow:hidden;">
    <div style="background:{header_color};padding:16px 24px;">
      <h2 style="margin:0;color:#fff;font-size:18px;">
        📊 {symbol} — soglia variazione raggiunta
      </h2>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 20px;">
        Il titolo <strong>{symbol}</strong> ha superato la soglia di variazione
        impostata (<strong>±{threshold_pct:.0f}%</strong>).
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:15px;">
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">
            Prezzo di riferimento
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;
                     font-weight:600;">
            {ref_price:.2f}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#64748b;">
            Prezzo attuale
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;
                     font-weight:600;">
            {current_price:.2f}
          </td>
        </tr>
        <tr>
          <td style="padding:8px 12px;color:#64748b;">Variazione</td>
          <td style="padding:8px 12px;text-align:right;font-weight:700;
                     font-size:18px;color:{value_color};">
            {change_pct:+.2f}%
          </td>
        </tr>
      </table>
      {_disclaimer_block()}
    </div>
  </div>
</body>
</html>"""
    return subject, html


def _disclaimer_block() -> str:
    return (
        f"<hr style='border:none;border-top:1px solid #e2e8f0;margin:20px 0;'>"
        f"<p style='font-size:11px;color:#94a3b8;margin:0;'>{_DISCLAIMER}</p>"
    )
