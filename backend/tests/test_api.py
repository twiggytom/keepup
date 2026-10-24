def _profile(client, birth_date="1950-01-01", sex="female"):
    return client.put("/api/profile", json={"birth_date": birth_date, "sex": sex})


def test_auth_flow(client):
    r = client.post("/api/auth/register", json={"email": "B@Example.com", "password": "password123"})
    assert r.status_code == 201
    assert client.get("/api/auth/me").json()["email"] == "b@example.com"
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401
    assert client.post("/api/auth/login", json={"email": "b@example.com", "password": "wrongpass1"}).status_code == 401
    assert client.post("/api/auth/login", json={"email": "b@example.com", "password": "password123"}).status_code == 200


def test_session_requires_profile(authed):
    r = authed.post("/api/sessions", json={"started_at": "2026-01-01T10:00:00Z", "raw_reps": 10})
    assert r.status_code == 409


def test_session_scoring(authed):
    _profile(authed)  # female, 75 on 2026-01-01 -> threshold 10
    r = authed.post(
        "/api/sessions",
        json={
            "started_at": "2026-01-01T10:00:00Z",
            "raw_reps": 9,
            "rep_events": [{"index": 0, "t_sit_start": 0.2, "t_stand_peak": 1.4, "t_sit_end": 2.9, "duration_s": 2.7}],
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert (body["age_at_test"], body["cdc_threshold"], body["below_threshold"]) == (76, 10, True)

    detail = authed.get(f"/api/sessions/{body['id']}").json()
    assert len(detail["rep_events"]) == 1
    assert len(authed.get("/api/sessions").json()) == 1


def test_arms_used_scores_zero(authed):
    _profile(authed)
    body = authed.post(
        "/api/sessions", json={"started_at": "2026-01-01T10:00:00Z", "raw_reps": 14, "used_arms": True}
    ).json()
    assert (body["raw_reps"], body["reps"], body["below_threshold"]) == (14, 0, True)


def test_out_of_frame_invalidates(authed):
    _profile(authed)
    body = authed.post(
        "/api/sessions",
        json={"started_at": "2026-01-01T10:00:00Z", "raw_reps": 12, "quality_flags": {"out_of_frame_s": 4.2}},
    ).json()
    assert body["valid"] is False
    assert body["below_threshold"] is None
