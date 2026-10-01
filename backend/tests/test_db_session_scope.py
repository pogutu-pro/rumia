"""Guard: every route must use `Depends(get_db_session, scope="function")`.

With the default scope FastAPI commits the session only after the response is sent, so a client's
immediate follow-up request can miss the write (create-then-list returns stale data).
"""
from fastapi.routing import APIRoute

from app.core.database import get_db_session
from app.main import app


def _walk(dependant):
    for dep in dependant.dependencies:
        yield dep
        yield from _walk(dep)


def test_every_db_session_dependency_commits_before_the_response():
    offenders = []
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        for dep in _walk(route.dependant):
            if dep.call is get_db_session and dep.scope != "function":
                offenders.append(f"{sorted(route.methods)} {route.path}")
    assert not offenders, f'Use Depends(get_db_session, scope="function") on: {offenders}'
