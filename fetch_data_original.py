"""
fetch_data.py — EngagementManager Sprint KPI Dashboard
Runs daily via GitHub Action → writes public/data.json
Includes memberStats for the Teams tab member breakdown table.
"""
import os, json, requests
from datetime import datetime, timezone

TENANT_ID     = os.environ["PBI_TENANT_ID"]
CLIENT_ID     = os.environ["PBI_CLIENT_ID"]
CLIENT_SECRET = os.environ["PBI_CLIENT_SECRET"]
DATASET_ID    = os.environ["PBI_DATASET_ID"]

def get_token():
    r = requests.post(
        f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
        data={"grant_type":"client_credentials","client_id":CLIENT_ID,
              "client_secret":CLIENT_SECRET,
              "scope":"https://analysis.windows.net/powerbi/api/.default"},
        timeout=30)
    r.raise_for_status()
    return r.json()["access_token"]

def dax(token, query):
    r = requests.post(
        f"https://api.powerbi.com/v1.0/myorg/datasets/{DATASET_ID}/executeQueries",
        headers={"Authorization":f"Bearer {token}","Content-Type":"application/json"},
        json={"queries":[{"query":query}],"serializerSettings":{"includeNulls":True}},
        timeout=90)
    r.raise_for_status()
    return r.json()["results"][0]["tables"][0].get("rows",[])

def sprint_id(sname):
    parts = (sname or "").split("_")
    return next((p for p in parts if p.startswith("S") and p[1:].isdigit()), sname)

def n(v): return round(float(v),1) if v not in (None,"") else 0

print("Getting token...")
token = get_token()

# ── Sprint history ─────────────────────────────────────────────────────────────
print("Fetching sprint data...")
sprint_rows = dax(token, """
EVALUATE
ADDCOLUMNS(
    FILTER(Dim_Iteration, Dim_Iteration[IsPastSprint] = TRUE()),
    "vel",  [Velocity],
    "comm", [Committed SP],
    "thru", [Throughput],
    "bugs", [Bug Count],
    "dd",   [Defect Density %],
    "cr",   [Sprint Completion Rate %],
    "pi",   [Predictability Index],
    "cy",   [Median Cycle Time (days)],
    "ld",   [Median Lead Time (days)],
    "wip",  [WIP Count],
    "us",   [User Story Count],
    "bc",   [Bugs Closed]
)
ORDER BY Dim_Iteration[SprintNumber]
""")
sprints = []
for i, r in enumerate(sprint_rows):
    sn   = r.get("Dim_Iteration[SprintName]","")
    parts= sn.split("_")
    sid  = next((p for p in parts if p.startswith("S") and p[1:].isdigit()), f"S{i+1:02d}")
    dpart= parts[-1] if len(parts)>2 else ""
    lbl  = dpart.split("-")[0] if "-" in dpart else ""
    sprints.append({"n":i+1,"id":sid,"q":r.get("Dim_Iteration[Quarter]","Q1"),
        "label":lbl,"vel":n(r.get("[vel]",0)),"comm":n(r.get("[comm]",0)),
        "thru":int(r.get("[thru]",0) or 0),"bugs":int(r.get("[bugs]",0) or 0),
        "dd":round(float(r.get("[dd]",0) or 0),4),"cr":round(float(r.get("[cr]",0) or 0),4),
        "pi":round(float(r.get("[pi]",0) or 0),4),"cy":n(r.get("[cy]",0)),
        "ld":n(r.get("[ld]",0)),"wip":int(r.get("[wip]",0) or 0),
        "us":int(r.get("[us]",0) or 0),"bc":int(r.get("[bc]",0) or 0)})
print(f"  {len(sprints)} past sprints")

# ── Current sprint ────────────────────────────────────────────────────────────
print("Fetching current sprint...")
curr_rows = dax(token, """
EVALUATE
FILTER(
    ADDCOLUMNS(Dim_Iteration,
        "vel",  [Velocity], "comm", [Committed SP], "remSP", [Remaining SP],
        "thru", [Throughput], "items",[Total Items], "bugs", [Bug Count],
        "wip",  [WIP Count], "open", [Open Items], "stale",[Stale Items (>5 days)],
        "cr",   [Sprint Completion Rate %], "pi",   [Predictability Index],
        "us",   [User Story Count], "bc",  [Bugs Closed], "dd", [Defect Density %]
    ),
    Dim_Iteration[IsCurrentSprint] = TRUE()
)
""")
current = {}
if curr_rows:
    r = curr_rows[0]
    current = {"vel":n(r.get("[vel]",0)),"comm":n(r.get("[comm]",0)),
        "remSP":n(r.get("[remSP]",0)),"thru":int(r.get("[thru]",0) or 0),
        "items":int(r.get("[items]",0) or 0),"bugs":int(r.get("[bugs]",0) or 0),
        "wip":int(r.get("[wip]",0) or 0),"open":int(r.get("[open]",0) or 0),
        "stale":int(r.get("[stale]",0) or 0),"cr":round(float(r.get("[cr]",0) or 0),4),
        "pi":round(float(r.get("[pi]",0) or 0),4),"us":int(r.get("[us]",0) or 0),
        "bc":int(r.get("[bc]",0) or 0),"dd":round(float(r.get("[dd]",0) or 0),4),"daysLeft":7}

# ── Teams ─────────────────────────────────────────────────────────────────────
print("Fetching teams...")
team_rows = dax(token, """
EVALUATE
ADDCOLUMNS(VALUES(Fact_WorkItems[TeamName]),
    "vel",  [Velocity], "comm", [Committed SP], "thru", [Throughput],
    "bugs", [Bug Count], "bc",  [Bugs Closed], "wip",  [WIP Count],
    "cr",   [Sprint Completion Rate %], "us",   [User Story Count],
    "stale",[Stale Items (>5 days)]
)
ORDER BY [vel] DESC
""")
COLORS = {"Falcons":"#1D4ED8","Titans":"#7C3AED","Dragons":"#0891B2","Spartans":"#059669"}
teams = [{"name":r.get("Fact_WorkItems[TeamName]",""),"vel":n(r.get("[vel]",0)),
    "comm":n(r.get("[comm]",0)),"thru":int(r.get("[thru]",0) or 0),
    "bugs":int(r.get("[bugs]",0) or 0),"bugsClosed":int(r.get("[bc]",0) or 0),
    "wip":int(r.get("[wip]",0) or 0),"cr":round(float(r.get("[cr]",0) or 0),4),
    "us":int(r.get("[us]",0) or 0),"stale":int(r.get("[stale]",0) or 0),
    "color":COLORS.get(r.get("Fact_WorkItems[TeamName]",""),"#6366F1")} for r in team_rows]

# ── Global ────────────────────────────────────────────────────────────────────
print("Fetching global...")
glob_rows = dax(token, """
EVALUATE ROW(
    "vel",[Velocity],"comm",[Committed SP],"thru",[Throughput],
    "bugs",[Bug Count],"wip",[WIP Count],"cr",[Sprint Completion Rate %],
    "stale",[Stale Items (>5 days)],"items",[Total Items],
    "l5",[Rolling Avg Velocity (L5)],"avgSP",[Avg SP per Item],"us",[User Story Count]
)
""")
glb = {}
if glob_rows:
    r = glob_rows[0]
    glb = {"totalVel":n(r.get("[vel]",0)),"totalComm":n(r.get("[comm]",0)),
        "totalThru":int(r.get("[thru]",0) or 0),"totalBugs":int(r.get("[bugs]",0) or 0),
        "totalWIP":int(r.get("[wip]",0) or 0),"cr":round(float(r.get("[cr]",0) or 0),4),
        "stale":int(r.get("[stale]",0) or 0),"items":int(r.get("[items]",0) or 0),
        "l5":n(r.get("[l5]",0)),"avgSP":round(float(r.get("[avgSP]",0) or 0),2),
        "us":int(r.get("[us]",0) or 0)}

# ── Member stats (Teams tab breakdown table) ──────────────────────────────────
print("Fetching member stats...")
# Filter future sprints by name (S14, S15 etc) — avoids cross-table ref issues
ms_rows = dax(token, """
EVALUATE
ADDCOLUMNS(
    SUMMARIZE(
        FILTER(Fact_WorkItems,
            Fact_WorkItems[WorkItemType] IN {"User Story","Bug"}
            && NOT ISBLANK(Fact_WorkItems[AssignedToName])
            && NOT ISBLANK(Fact_WorkItems[TeamName])
            && NOT(CONTAINSSTRING(Fact_WorkItems[SprintName], "S14"))
            && NOT(CONTAINSSTRING(Fact_WorkItems[SprintName], "S15"))
            && NOT(CONTAINSSTRING(Fact_WorkItems[SprintName], "S16"))
        ),
        Fact_WorkItems[TeamName],
        Fact_WorkItems[AssignedToName],
        Fact_WorkItems[SprintName],
        Fact_WorkItems[SprintNumber]
    ),
    "items",  CALCULATE(COUNTROWS(Fact_WorkItems),
                  Fact_WorkItems[WorkItemType] IN {"User Story","Bug"}),
    "sp",     CALCULATE(SUM(Fact_WorkItems[StoryPoints]),
                  Fact_WorkItems[WorkItemType] IN {"User Story","Bug"}),
    "done",   CALCULATE(SUM(Fact_WorkItems[StoryPoints]),
                  Fact_WorkItems[WorkItemType] IN {"User Story","Bug"},
                  Fact_WorkItems[State] IN {"Closed","Resolved"}),
    "closed", CALCULATE(COUNTROWS(Fact_WorkItems),
                  Fact_WorkItems[WorkItemType] IN {"User Story","Bug"},
                  Fact_WorkItems[State] IN {"Closed","Resolved"}),
    "wip",    CALCULATE(COUNTROWS(Fact_WorkItems),
                  Fact_WorkItems[WorkItemType] IN {"User Story","Bug"},
                  Fact_WorkItems[State] = "Active"),
    "spill",  CALCULATE(COUNTROWS(Fact_WorkItems),
                  Fact_WorkItems[WorkItemType] IN {"User Story","Bug"},
                  Fact_WorkItems[State] IN {"New","Ready"})
)
ORDER BY Fact_WorkItems[TeamName], Fact_WorkItems[SprintNumber],
         Fact_WorkItems[AssignedToName]
""")

member_stats = []
for r in ms_rows:
    snum = int(r.get("Fact_WorkItems[SprintNumber]", 0) or 0)
    sname = r.get("Fact_WorkItems[SprintName]", "")
    if snum == 0: continue
    # Skip any future sprint names beyond what CONTAINSSTRING filters above
    if any(f"S{n:02d}" in sname for n in range(14, 30)): continue
    member_stats.append({
        "team":   r.get("Fact_WorkItems[TeamName]", ""),
        "member": r.get("Fact_WorkItems[AssignedToName]", ""),
        "sprint": sprint_id(r.get("Fact_WorkItems[SprintName]", "")),
        "sn":     snum,
        "items":  int(r.get("[items]", 0) or 0),
        "sp":     round(float(r.get("[sp]", 0) or 0), 1),
        "done":   round(float(r.get("[done]", 0) or 0), 1),
        "closed": int(r.get("[closed]", 0) or 0),
        "wip":    int(r.get("[wip]", 0) or 0),
        "spill":  int(r.get("[spill]", 0) or 0),
    })
print(f"  {len(member_stats)} member-sprint rows")

# ── Write output ──────────────────────────────────────────────────────────────
out = {"lastRefreshed": datetime.now(timezone.utc).isoformat(),
       "sprints": sprints, "current": current, "teams": teams,
       "global": glb, "memberStats": member_stats}

path = os.path.join(os.path.dirname(__file__), "public", "data.json")
os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w") as f:
    json.dump(out, f, indent=2)

print(f"\n✓ data.json written — {len(sprints)} sprints, {len(teams)} teams, "
      f"{len(member_stats)} member rows")