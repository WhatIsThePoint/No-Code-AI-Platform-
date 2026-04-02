import requests

_session = requests.Session()
_session.timeout = 30


def get_http_session() -> requests.Session:
    return _session
