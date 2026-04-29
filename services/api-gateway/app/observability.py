"""
Lightweight Sentry/GlitchTip bootstrap. Imported by every Flask service.

Reads `SENTRY_DSN` from the environment. When unset (the dev default) the
sentry-sdk `init` becomes a no-op — no events are sent, no background
threads, no startup overhead. A real DSN turns the same code path into a
real client without conditional imports scattered through the services.
"""

from __future__ import annotations

import os
import logging

_LOG = logging.getLogger(__name__)


def init_sentry(service_name: str) -> None:
    dsn = os.environ.get("SENTRY_DSN") or ""
    if not dsn:
        # Dev mode — silently skip so a running platform without GlitchTip
        # configured doesn't spam logs.
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
            # Tag every event with the originating service so the dashboard
            # can filter `service:auth-service` etc.
            before_send=lambda event, _hint: {
                **event,
                "tags": {**(event.get("tags") or {}), "service": service_name},
            },
        )
    except Exception as exc:  # never crash boot on observability misconfig
        _LOG.warning("sentry init failed for %s: %s", service_name, exc)
