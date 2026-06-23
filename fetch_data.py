"""
fetch_data.py
Runs daily via GitHub Action.
Queries Power BI REST API → writes public/data.json
"""

import os
import json
import requests
from datetime import datetime, timezone

# ── CONFIG — set these as GitHub Secrets ─────────────────────────────────────
TENANT_ID    = os.environ["PBI_TENANT_ID"]
CLIENT_ID    = os.environ["PBI_CLIENT_ID"]
CLIENT_SECRET= os.environ["PBI_CLIENT_SECRET"]
DATASET_ID   = os.environ["PBI_DATASET_ID"]

# ── STEP 1 — Get access token ─────────────────────────────────────────────────
def get_token():
    url  = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token"
    data = {
        "grant_type":    "client_credentials",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "https://analysis.windows.net/powerbi/api/.default"
    }
    r = requests.post(url, data=data)
    r.raise_for_status()
    return r.json()["access_token"]

# ── STEP 2 — Run a DAX query ──────────────────────────────────────────────────
def run_dax(token, query):
    url     = f"https://api.powerbi.com/v1.0/myorg/datasets/{DATASET_ID}/executeQueries"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body    = {"queries": [{"query": query}], "serializerSettings": {"includeNulls": True}}
    r       = requests.post(url, headers=headers, json=body)
    r.raise_for_status()
    results = r.json()
    rows    = results["results"][0]["tables"][0].get("rows", [])
    return rows

# ── STEP 3 — Fetch all data ───────────────────────────────────────────────────
def fetch_all():
    print("Getting token...")
    token = get_token()
    print("Token acquired.")

    # Past sprints
    print("Fetching sprint data...")
    sprint_rows = run_dax(token, """
        EVALUATE
        ADDCOLUMNS(
            FILTER(Dim_Iteration, Dim_Iteration[IsPastSprint] = TRUE()),
            "Velocity",      [Velocity],
            "CommittedSP",   [Committed SP],
            "Throughput",    [Throughput],
            "Bugs",          [Bug Count],
            "DefectDensity", [Defect Density %],
            "CompRate",      [Sprint Completion Rate %],
            "CycleP50",      [Median Cycle Time (days)],
            "LeadP50",       [Median Lead Time (days)],
            "WIP",           [WIP Count],
            "UserStories",   [User Story Count],
            "BugsClosed",    [Bugs Closed],
            "Predictability",[Predictability Index]
        )
        ORDER BY Dim_Iteration[SprintNumber]
    """)

    sprints = []
    quarter_map = {"Q1": "Q1", "Q2": "Q2", "Q3": "Q3", "Q4": "Q4"}

    for i, row in enumerate(sprint_rows):
        sprint_name = row.get("Dim_Iteration[SprintName]", "")
        # Extract short label e.g. "S01" from "2026_S01_Dec31-Jan13"
        parts = sprint_name.split("_")
        short_id = next((p for p in parts if p.startswith("S") and p[1:].isdigit()), f"S{i+1:02d}")
        date_part = parts[-1] if len(parts) > 2 else ""
        label = date_part.split("-")[0] if "-" in date_part else ""

        sprints.append({
            "n":    i + 1,
            "id":   short_id,
            "q":    row.get("Dim_Iteration[Quarter]", "Q1"),
            "label": label,
            "vel":  round(row.get("[Velocity]", 0) or 0, 1),
            "comm": round(row.get("[CommittedSP]", 0) or 0, 1),
            "thru": int(row.get("[Throughput]", 0) or 0),
            "bugs": int(row.get("[Bugs]", 0) or 0),
            "dd":   round(row.get("[DefectDensity]", 0) or 0, 4),
            "cr":   round(row.get("[CompRate]", 0) or 0, 4),
            "pi":   round(row.get("[Predictability]", 0) or 0, 4),
            "cy":   round(row.get("[CycleP50]", 0) or 0, 2),
            "ld":   round(row.get("[LeadP50]", 0) or 0, 2),
            "wip":  int(row.get("[WIP]", 0) or 0),
            "us":   int(row.get("[UserStories]", 0) or 0),
            "bc":   int(row.get("[BugsClosed]", 0) or 0),
        })

    # Current sprint
    print("Fetching current sprint...")
    curr_rows = run_dax(token, """
        EVALUATE
        FILTER(
            ADDCOLUMNS(
                Dim_Iteration,
                "Velocity",       [Velocity],
                "CommittedSP",    [Committed SP],
                "RemainingSP",    [Remaining SP],
                "Throughput",     [Throughput],
                "TotalItems",     [Total Items],
                "Bugs",           [Bug Count],
                "WIP",            [WIP Count],
                "OpenItems",      [Open Items],
                "Stale",          [Stale Items (>5 days)],
                "CompRate",       [Sprint Completion Rate %],
                "UserStories",    [User Story Count],
                "BugsClosed",     [Bugs Closed],
                "DefectDensity",  [Defect Density %],
                "RemainingDays",  [Remaining Working Days]
            ),
            Dim_Iteration[IsCurrentSprint] = TRUE()
        )
    """)

    current = {}
    if curr_rows:
        r = curr_rows[0]
        current = {
            "vel":      round(r.get("[Velocity]", 0) or 0, 1),
            "comm":     round(r.get("[CommittedSP]", 0) or 0, 0),
            "remSP":    round(r.get("[RemainingSP]", 0) or 0, 0),
            "thru":     int(r.get("[Throughput]", 0) or 0),
            "items":    int(r.get("[TotalItems]", 0) or 0),
            "bugs":     int(r.get("[Bugs]", 0) or 0),
            "wip":      int(r.get("[WIP]", 0) or 0),
            "open":     int(r.get("[OpenItems]", 0) or 0),
            "stale":    int(r.get("[Stale]", 0) or 0),
            "cr":       round(r.get("[CompRate]", 0) or 0, 4),
            "us":       int(r.get("[UserStories]", 0) or 0),
            "bc":       int(r.get("[BugsClosed]", 0) or 0),
            "dd":       round(r.get("[DefectDensity]", 0) or 0, 4),
            "daysLeft": int(r.get("[RemainingDays]", 0) or 0),
        }

    # Teams
    print("Fetching team data...")
    team_rows = run_dax(token, """
        EVALUATE
        ADDCOLUMNS(
            VALUES(Fact_WorkItems[TeamName]),
            "Velocity",    [Velocity],
            "CommittedSP", [Committed SP],
            "Throughput",  [Throughput],
            "Bugs",        [Bug Count],
            "BugsClosed",  [Bugs Closed],
            "WIP",         [WIP Count],
            "CompRate",    [Sprint Completion Rate %],
            "UserStories", [User Story Count],
            "Stale",       [Stale Items (>5 days)]
        )
        ORDER BY [Velocity] DESC
    """)

    team_colors = {
        "Falcons": "#1D4ED8",
        "Titans":  "#7C3AED",
        "Dragons": "#0891B2",
        "Spartans":"#059669"
    }

    teams = []
    for r in team_rows:
        name = r.get("Fact_WorkItems[TeamName]", "")
        teams.append({
            "name":       name,
            "vel":        round(r.get("[Velocity]", 0) or 0, 1),
            "comm":       round(r.get("[CommittedSP]", 0) or 0, 1),
            "thru":       int(r.get("[Throughput]", 0) or 0),
            "bugs":       int(r.get("[Bugs]", 0) or 0),
            "bugsClosed": int(r.get("[BugsClosed]", 0) or 0),
            "wip":        int(r.get("[WIP]", 0) or 0),
            "cr":         round(r.get("[CompRate]", 0) or 0, 4),
            "us":         int(r.get("[UserStories]", 0) or 0),
            "stale":      int(r.get("[Stale]", 0) or 0),
            "color":      team_colors.get(name, "#6366F1")
        })

    # Global totals
    print("Fetching global totals...")
    global_rows = run_dax(token, """
        EVALUATE
        ROW(
            "TotalVelocity",   [Velocity],
            "TotalCommitted",  [Committed SP],
            "TotalThroughput", [Throughput],
            "TotalBugs",       [Bug Count],
            "TotalWIP",        [WIP Count],
            "CompRate",        [Sprint Completion Rate %],
            "Stale",           [Stale Items (>5 days)],
            "Items",           [Total Items],
            "L5Avg",           [Rolling Avg Velocity (L5)],
            "AvgSP",           [Avg SP per Item],
            "UserStories",     [User Story Count]
        )
    """)

    global_data = {}
    if global_rows:
        r = global_rows[0]
        global_data = {
            "totalVel":  round(r.get("[TotalVelocity]", 0) or 0, 1),
            "totalComm": round(r.get("[TotalCommitted]", 0) or 0, 1),
            "totalThru": int(r.get("[TotalThroughput]", 0) or 0),
            "totalBugs": int(r.get("[TotalBugs]", 0) or 0),
            "totalWIP":  int(r.get("[TotalWIP]", 0) or 0),
            "cr":        round(r.get("[CompRate]", 0) or 0, 4),
            "stale":     int(r.get("[Stale]", 0) or 0),
            "items":     int(r.get("[Items]", 0) or 0),
            "l5":        round(r.get("[L5Avg]", 0) or 0, 1),
            "avgSP":     round(r.get("[AvgSP]", 0) or 0, 2),
            "us":        int(r.get("[UserStories]", 0) or 0),
        }

    return {
        "lastRefreshed": datetime.now(timezone.utc).isoformat(),
        "sprints":       sprints,
        "current":       current,
        "teams":         teams,
        "global":        global_data
    }

# ── MAIN ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    data = fetch_all()

    # Write to public/data.json (React serves static files from public/)
    output_path = os.path.join(os.path.dirname(__file__), "public", "data.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(data, f, indent=2)

    print(f"\nData written to {output_path}")
    print(f"Last refreshed: {data['lastRefreshed']}")
    print(f"Sprints: {len(data['sprints'])}")
    print(f"Teams: {len(data['teams'])}")
    print(f"Current sprint velocity: {data['current'].get('vel')}")
    print("Done.")
