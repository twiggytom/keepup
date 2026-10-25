def _profile(client):
    client.put("/api/profile", json={"birth_date": "1950-01-01", "sex": "female"})


def _session(client, day, reps, *, quality=95, valid=True, used_arms=False, mean_s=2.5):
    body = {
        "started_at": f"2026-{day}T10:00:00Z",
        "raw_reps": reps,
        "used_arms": used_arms,
        "quality_flags": {"out_of_frame_s": 0 if valid else 5},
        "metrics": {"version": 1, "quality_score": quality, "speed": {"mean_s": mean_s}},
    }
    assert client.post("/api/sessions", json=body).status_code == 201


def test_requires_auth(client):
    assert client.get("/api/trends").status_code == 401


def test_insufficient_until_three_counted(authed):
    _profile(authed)
    _session(authed, "01-01", 12)
    _session(authed, "01-15", 12)
    _session(authed, "02-01", 3, valid=False)  # not counted: does not help reach 3
    t = authed.get("/api/trends").json()
    assert t["reps"]["status"] == "insufficient_data"
    assert t["reps"]["needed"] == 1
    assert len(t["points"]) == 3


def test_low_quality_plotted_but_not_fitted(authed):
    _profile(authed)
    for day, reps in [("01-01", 14), ("02-01", 13), ("03-01", 11), ("04-01", 10)]:
        _session(authed, day, reps)
    _session(authed, "04-15", 20, quality=40)  # would flip the trend if it were fitted
    _session(authed, "04-20", 14, used_arms=True)

    t = authed.get("/api/trends").json()
    assert t["reps"]["status"] == "declining"
    assert t["reps"]["n"] == 4
    by_reason = {p["excluded_reason"] for p in t["points"] if not p["in_fit"]}
    assert by_reason == {"low_quality", "arms_used"}
    assert [p["started_at"][:10] for p in t["points"]] == sorted(p["started_at"][:10] for p in t["points"])


def test_movement_trend_skips_sessions_without_metrics(authed):
    _profile(authed)
    for day, mean_s in [("01-01", 2.2), ("02-01", 2.5), ("03-01", 2.8)]:
        _session(authed, day, 12, mean_s=mean_s)
    t = authed.get("/api/trends").json()
    assert t["mean_stand_s"]["status"] == "declining"
    assert t["fatigue_index"]["status"] == "insufficient_data"
