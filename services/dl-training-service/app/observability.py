"""
Lightweight Sentry/GlitchTip bootstrap. Mirrors the helper used by every
other Flask service so every microservice tags its events identically.

Reads `SENTRY_DSN` from the environment. Unset (the dev default) makes the
sentry-sdk init a no-op — no events sent, no background threads, no startup
overhead.
"""

from __future__ import annotations

import logging
import os

_LOG = logging.getLogger(__name__)


def init_sentry(service_name: str) -> None:
    dsn = os.environ.get("SENTRY_DSN") or ""
    if not dsn:
        return
    try:
        import sentry_sdk
        from sentry_sdk.integrations.flask import FlaskIntegration

        sentry_sdk.init(
            dsn=dsn,
            integrations=[FlaskIntegration()],
            traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE", "0.0")),
            send_default_pii=False,
            release=os.environ.get("APP_RELEASE") or os.environ.get("GIT_SHA") or None,
            environment=os.environ.get("APP_ENV", "development"),
            server_name=service_name,
            before_send=lambda event, _hint: {
                **event,
                "tags": {**(event.get("tags") or {}), "service": service_name},
            },
        )
    except Exception as exc:  # never crash boot on observability misconfig
        _LOG.warning("sentry init failed for %s: %s", service_name, exc)
