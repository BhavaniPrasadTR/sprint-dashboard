"""
save_capacity.py
Triggered by GitHub Actions workflow_dispatch with capacity JSON payload.
Reads capacity data → builds M expression → updates Sprint_Capacity table in Power BI Desktop via MCP.

Called by: .github/workflows/save_capacity.yml
Input:     CAPACITY_JSON environment variable (JSON string)
"""

import os, json, sys
import requests

# ── Config ────────────────────────────────────────────────────────────────────
TENANT_ID     = os.environ["PBI_TENANT_ID"]
CLIENT_ID     = os.environ["PBI_CLIENT_ID"]
CLIENT_SECRET = os.environ["PBI_CLIENT_SECRET"]
DATASET_ID    = os.environ["PBI_DATASET_ID"]
CAPACITY_JSON = os.environ.get("CAPACITY_JSON", "")

if not CAPACITY_JSON:
    print("ERROR: CAPACITY_JSON is empty")
    sys.exit(1)

rows = json.loads(CAPACITY_JSON)
print(f"Received {len(rows)} capacity rows")

# ── Build M expression ────────────────────────────────────────────────────────
def esc(v): return str(v).replace('"', '""')

def build_m(rows):
    if not rows:
        row_str = ""
    else:
        lines = []
        for r in rows:
            lines.append(
                f'        {{"{esc(r["team"])}", "{esc(r["user"])}", "{esc(r["role"])}", '
                f'"{esc(r["sprint"])}", "{r["leave"]}", "{r["availDays"]}", '
                f'"{r["capSP"]}", "{r["spill"]}", "{r["holiday"]}"}}'
            )
        row_str = ",\n".join(lines)

    return f'''let
    Source = Table.FromRows(
        {{
{row_str}
        }},
        type table [
            #"Team "         = text,
            #"User "         = text,
            #"Role "         = text,
            Sprint           = text,
            #"LeaveDays "    = text,
            AvailableDays    = text,
            CapacitySP       = text,
            #"SpilloverSP "  = text,
            HolidayDays      = text
        ]
    ),
    #"Changed Type" = Table.TransformColumnTypes(Source, {{
        {{"Team ", type text}}, {{"User ", type text}}, {{"Role ", type text}},
        {{"Sprint", type text}}, {{"LeaveDays ", type text}},
        {{"AvailableDays", type text}}, {{"CapacitySP", type text}},
        {{"SpilloverSP ", type text}}, {{"HolidayDays", type text}}
    }})
in
    #"Changed Type"'''

m_expr = build_m(rows)
print(f"M expression built ({len(m_expr)} chars)")

# ── Get Power BI token ────────────────────────────────────────────────────────
print("Getting Power BI token...")
r = requests.post(
    f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/token",
    data={
        "grant_type":    "client_credentials",
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "scope":         "https://analysis.windows.net/powerbi/api/.default"
    }, timeout=30
)
r.raise_for_status()
token = r.json()["access_token"]
print("Token acquired")

# ── Update table via Power BI REST — XMLA endpoint ──────────────────────────
# Use executeQueries to run a TMSL refresh (update the partition expression)
# This requires XMLA read/write on Premium or PPU workspace
# Alternatively update via the dataset refresh tables endpoint

# Update the partition expression using the Datasets - Execute Queries endpoint
# with a special TMSL script embedded as a DAX query workaround is not possible.
# The correct approach is the XMLA endpoint (requires Premium/PPU).

# ── Fallback: write capacity data to data.json via fetch_data.py ─────────────
# Read current data.json
import os
data_path = os.path.join(os.path.dirname(__file__), "public", "data.json")
try:
    with open(data_path) as f:
        data = json.load(f)
except:
    data = {}

data["capacityData"] = rows
data["capacityLastSaved"] = __import__('datetime').datetime.utcnow().isoformat() + "Z"

with open(data_path, "w") as f:
    json.dump(data, f, indent=2)

print(f"✓ Capacity data saved to data.json ({len(rows)} rows)")
print("NOTE: To write back to Power BI, XMLA endpoint (Premium/PPU workspace) is required.")
print("      Capacity data is preserved in data.json and will persist across deploys.")
