"""Thin SMTP helper. Targets MailHog in dev; any RFC-compliant SMTP in prod.

Designed to never throw at the call site — a mail failure must not break a
registration. Errors are logged and the caller continues.
"""
import logging
import smtplib
from email.message import EmailMessage

from flask import current_app

logger = logging.getLogger(__name__)


def send_mail(
    *, to: str, subject: str, html_body: str, text_body: str | None = None
) -> bool:
    """Send an email via the configured SMTP server. Returns True on success."""
    cfg = current_app.config
    server = cfg.get("MAIL_SERVER", "")
    if not server:
        logger.info("MAIL_SERVER unset; skipping mail to %s (%s)", to, subject)
        return False

    msg = EmailMessage()
    msg["From"] = cfg["MAIL_FROM"]
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(text_body or _html_to_text(html_body))
    msg.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(server, cfg["MAIL_PORT"], timeout=10) as smtp:
            if cfg.get("MAIL_USE_TLS"):
                smtp.starttls()
            if cfg.get("MAIL_USERNAME"):
                smtp.login(cfg["MAIL_USERNAME"], cfg["MAIL_PASSWORD"])
            smtp.send_message(msg)
        logger.info("mail.sent to=%s subject=%s", to, subject)
        return True
    except Exception as e:
        logger.warning("mail.failed to=%s subject=%s err=%s", to, subject, e)
        return False


def send_verification_email(*, to: str, full_name: str | None, link: str) -> bool:
    name = full_name or to.split("@")[0]
    subject = "Verify your No-Code AI account"
    html_body = f"""\
<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 24px auto; color: #1d1d1f;">
  <h2 style="margin: 0 0 12px 0;">Welcome, {name}.</h2>
  <p>Thanks for signing up to the No-Code AI Platform.</p>
  <p>Click the button below to verify your email address. The link expires in 24 hours.</p>
  <p style="margin: 28px 0;">
    <a href="{link}" style="background:#ff6600;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Verify my email</a>
  </p>
  <p style="font-size: 12px; color: #6e6e73;">If the button doesn't work, paste this link into your browser:<br>
    <a href="{link}">{link}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size: 12px; color: #6e6e73;">If you did not create this account, you can ignore this email.</p>
</body></html>"""
    text_body = (
        f"Welcome, {name}.\n\n"
        f"Thanks for signing up to the No-Code AI Platform.\n\n"
        f"Verify your email by opening the link below (expires in 24 hours):\n{link}\n\n"
        f"If you did not create this account, you can ignore this message."
    )
    return send_mail(to=to, subject=subject, html_body=html_body, text_body=text_body)


def send_password_reset_email(*, to: str, full_name: str | None, link: str) -> bool:
    name = full_name or to.split("@")[0]
    subject = "Reset your No-Code AI password"
    html_body = f"""\
<!doctype html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 560px; margin: 24px auto; color: #1d1d1f;">
  <h2 style="margin: 0 0 12px 0;">Reset your password, {name}.</h2>
  <p>We received a request to reset the password for your No-Code AI account.</p>
  <p>Click the button below to choose a new password. The link expires in 30 minutes.</p>
  <p style="margin: 28px 0;">
    <a href="{link}" style="background:#ff6600;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:600;">Choose a new password</a>
  </p>
  <p style="font-size: 12px; color: #6e6e73;">If the button doesn't work, paste this link into your browser:<br>
    <a href="{link}">{link}</a></p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
  <p style="font-size: 12px; color: #6e6e73;">If you did not ask for a password reset, you can safely ignore this email — your current password remains active.</p>
</body></html>"""
    text_body = (
        f"Reset your password, {name}.\n\n"
        f"We received a request to reset the password for your No-Code AI account.\n\n"
        f"Open this link within 30 minutes to choose a new password:\n{link}\n\n"
        f"If you did not request this, you can ignore this message — your current "
        f"password remains active."
    )
    return send_mail(to=to, subject=subject, html_body=html_body, text_body=text_body)


def _html_to_text(html: str) -> str:
    import re

    text = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\n\s*\n+", "\n\n", text).strip()
