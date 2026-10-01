import os
import io
import csv
import json
from datetime import datetime
from typing import Optional, List
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, UploadFile, File, Form, Query, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response, HTMLResponse
from pydantic import BaseModel

from .parsers.detector import parse_raw_log_content
from .store import GLOBAL_STORE
from .streaming.watcher import WS_MANAGER, SIMULATOR
from .generator.log_generator import (
    generate_microservices_logs,
    generate_nginx_logs,
    generate_auth_attack_logs,
    generate_springboot_stacktraces
)
from .analytics.ai_diagnostics import analyze_with_heuristics, analyze_with_gemini

def initialize_default_dataset():
    if not GLOBAL_STORE.datasets:
        dataset_name = "microservices_outage"
        raw_logs = generate_microservices_logs(400)
        entries, detected_parser = parse_raw_log_content(raw_logs, source_name="microservices_outage.json")
        dataset = GLOBAL_STORE.create_dataset(dataset_name, parser_type=detected_parser)
        dataset.add_entries(entries)

# Ensure initialized at module import for Serverless runtimes
initialize_default_dataset()

@asynccontextmanager
async def lifespan(app: FastAPI):
    initialize_default_dataset()
    yield
    if SIMULATOR.is_running:
        await SIMULATOR.stop()

app = FastAPI(
    title="LogDoc API",
    description="Enterprise Log Analysis, Drain Clustering, Anomaly Detection & AI Diagnostics Platform",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

@router.get("/")
def api_root():
    return {
        "status": "healthy",
        "app": "LogDoc",
        "version": "1.0.0",
        "datasets_count": len(GLOBAL_STORE.datasets),
        "active_dataset": GLOBAL_STORE.active_dataset_id
    }

@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "app": "LogDoc",
        "version": "1.0.0",
        "datasets_count": len(GLOBAL_STORE.datasets)
    }


@router.get("/datasets")
def get_datasets():
    return {
        "datasets": GLOBAL_STORE.list_datasets(),
        "active_dataset": GLOBAL_STORE.active_dataset_id
    }


class SelectDatasetPayload(BaseModel):
    name: str

@router.post("/datasets/select")
def select_dataset(payload: SelectDatasetPayload):
    if payload.name not in GLOBAL_STORE.datasets:
        raise HTTPException(status_code=404, detail="Dataset not found")
    GLOBAL_STORE.active_dataset_id = payload.name
    return {"status": "success", "active_dataset": payload.name}


@router.post("/upload")
async def upload_log_file(file: UploadFile = File(...)):
    try:
        content_bytes = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file content: {str(e)}")

    if not content_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty (0 bytes).")

    try:
        content_text = content_bytes.decode("utf-8")
    except UnicodeDecodeError:
        try:
            content_text = content_bytes.decode("latin-1")
        except Exception:
            raise HTTPException(status_code=400, detail="Unable to decode file as text. Please upload plain text log files.")

    raw_name = file.filename or "uploaded_log.log"
    # Normalize slashes and remove directory paths
    clean_name = os.path.basename(raw_name.replace("\\", "/"))
    # Keep safe alphanumeric, dots, dashes, underscores
    dataset_name = "".join(c for c in clean_name if c.isalnum() or c in ("-", "_", ".")) or "uploaded_log"

    entries, parser_name = parse_raw_log_content(content_text, source_name=dataset_name)

    if not entries:
        raise HTTPException(
            status_code=400,
            detail=f"No readable log lines detected in '{dataset_name}'. Please ensure the file contains valid log records."
        )

    dataset = GLOBAL_STORE.create_dataset(dataset_name, parser_type=parser_name)
    dataset.add_entries(entries)

    return {
        "status": "success",
        "dataset_name": dataset_name,
        "parser_used": parser_name,
        "total_parsed": len(entries),
        "error_count": dataset.metrics.get("level_counts", {}).get("ERROR", 0)
    }


class LoadSamplePayload(BaseModel):
    sample_type: str  # 'microservices_outage', 'nginx_access', 'auth_failures', 'springboot_stacktrace'

@router.post("/load-sample")
def load_sample_dataset(payload: LoadSamplePayload):
    st = payload.sample_type
    name = f"sample_{st}"
    
    if st == "microservices_outage":
        content = generate_microservices_logs(450)
    elif st == "nginx_access":
        content = generate_nginx_logs(400)
    elif st == "auth_failures":
        content = generate_auth_attack_logs(300)
    elif st == "springboot_stacktrace":
        content = generate_springboot_stacktraces(220)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown sample type: {st}")

    entries, parser_name = parse_raw_log_content(content, source_name=name)
    dataset = GLOBAL_STORE.create_dataset(name, parser_type=parser_name)
    dataset.add_entries(entries)

    return {
        "status": "success",
        "dataset_name": name,
        "parser_used": parser_name,
        "total_parsed": len(entries)
    }


@router.get("/logs")
def get_logs(
    dataset: Optional[str] = None,
    q: Optional[str] = None,
    is_regex: bool = False,
    levels: Optional[List[str]] = Query(None),
    services: Optional[List[str]] = Query(None),
    template_id: Optional[int] = None,
    start_epoch: Optional[float] = None,
    end_epoch: Optional[float] = None,
    limit: int = 100,
    offset: int = 0,
    sort_order: str = "desc"
):
    ds = GLOBAL_STORE.get_dataset(dataset)
    if not ds:
        return {"total": 0, "limit": limit, "offset": offset, "logs": []}

    return ds.filter_logs(
        query=q,
        is_regex=is_regex,
        levels=levels,
        services=services,
        template_id=template_id,
        start_epoch=start_epoch,
        end_epoch=end_epoch,
        limit=limit,
        offset=offset,
        sort_order=sort_order
    )


@router.get("/clusters")
def get_clusters(dataset: Optional[str] = None):
    ds = GLOBAL_STORE.get_dataset(dataset)
    if not ds:
        return {"clusters": []}
    return {"clusters": ds.clusters}


@router.get("/anomalies")
def get_anomalies(dataset: Optional[str] = None):
    ds = GLOBAL_STORE.get_dataset(dataset)
    if not ds:
        return {"anomalies": []}
    return {"anomalies": ds.anomalies}


@router.get("/metrics")
def get_metrics(dataset: Optional[str] = None):
    ds = GLOBAL_STORE.get_dataset(dataset)
    if not ds:
        return {}
    return ds.metrics


class DiagnosticsPayload(BaseModel):
    dataset: Optional[str] = None
    gemini_api_key: Optional[str] = None

@router.post("/diagnostics")
async def run_diagnostics(payload: DiagnosticsPayload):
    ds = GLOBAL_STORE.get_dataset(payload.dataset)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    api_key = payload.gemini_api_key or os.environ.get("GEMINI_API_KEY")

    if api_key:
        result = await analyze_with_gemini(
            api_key=api_key,
            entries=ds.entries_dict,
            top_errors=ds.metrics.get("top_errors", []),
            anomalies=ds.anomalies,
            metrics=ds.metrics
        )
    else:
        result = analyze_with_heuristics(
            entries=ds.entries_dict,
            top_errors=ds.metrics.get("top_errors", []),
            anomalies=ds.anomalies,
            metrics=ds.metrics
        )

    return result


class SimulatorControlPayload(BaseModel):
    action: str  # 'start' or 'stop'
    delay_seconds: float = 1.0

@router.post("/simulator/control")
async def control_simulator(payload: SimulatorControlPayload):
    if payload.action == "start":
        SIMULATOR.delay_seconds = payload.delay_seconds
        await SIMULATOR.start()
        return {"status": "started", "is_running": True}
    elif payload.action == "stop":
        await SIMULATOR.stop()
        return {"status": "stopped", "is_running": False}
    raise HTTPException(status_code=400, detail="Invalid action, use 'start' or 'stop'")


@router.get("/export")
def export_logs(
    format: str = "json", # 'json' or 'csv'
    dataset: Optional[str] = None,
    q: Optional[str] = None,
    is_regex: bool = False,
    levels: Optional[List[str]] = Query(None),
):
    ds = GLOBAL_STORE.get_dataset(dataset)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    res = ds.filter_logs(query=q, is_regex=is_regex, levels=levels, limit=10000, offset=0, sort_order="asc")
    logs = res["logs"]

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Timestamp", "Level", "Service", "Message", "Source", "Line"])
        for l in logs:
            writer.writerow([
                l.get("timestamp") or "",
                l.get("level") or "",
                l.get("service") or "",
                l.get("message") or "",
                l.get("source") or "",
                l.get("line_number") or ""
            ])
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={ds.name}_export.csv"}
        )
    else:
        return Response(
            content=json.dumps(logs, indent=2),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename={ds.name}_export.json"}
        )


@router.get("/export/report", response_class=HTMLResponse)
def generate_incident_report(dataset: Optional[str] = None):
    ds = GLOBAL_STORE.get_dataset(dataset)
    if not ds:
        raise HTTPException(status_code=404, detail="Dataset not found")

    diag = analyze_with_heuristics(
        entries=ds.entries_dict,
        top_errors=ds.metrics.get("top_errors", []),
        anomalies=ds.anomalies,
        metrics=ds.metrics
    )

    metrics = ds.metrics
    total = metrics.get("total_logs", 0)
    errors = metrics.get("level_counts", {}).get("ERROR", 0)
    error_rate = metrics.get("error_rate", 0)

    issues_html = ""
    for issue in diag.get("diagnosed_issues", []):
        remediation_li = "".join(f"<li>{r}</li>" for r in issue["remediation"])
        issues_html += f"""
        <div style="background: #1e293b; border-left: 4px solid #ef4444; padding: 16px; margin-bottom: 16px; border-radius: 4px;">
            <h3 style="margin-top:0; color:#f87171;">{issue['title']} <span style="font-size:12px; background:#450a0a; color:#fca5a5; padding:2px 8px; border-radius:999px;">Confidence {int(issue['confidence']*100)}%</span></h3>
            <p style="color:#cbd5e1;">{issue['root_cause']}</p>
            <h4 style="color:#94a3b8; margin-bottom: 6px;">Recommended Remediation:</h4>
            <ul style="color:#e2e8f0; margin-top:0;">{remediation_li}</ul>
        </div>
        """

    anomalies_html = ""
    for a in ds.anomalies:
        color = "#ef4444" if a.get("severity") in ["high", "critical"] else "#f59e0b"
        anomalies_html += f"""
        <div style="background: #1e293b; border: 1px solid #334155; padding: 12px; margin-bottom: 10px; border-radius: 6px;">
            <div style="display:flex; justify-content:space-between;">
                <strong style="color: {color};">{a['title']}</strong>
                <span style="font-size:12px; color:#94a3b8;">{a.get('timestamp') or ''}</span>
            </div>
            <p style="color:#94a3b8; margin: 6px 0 0 0; font-size:14px;">{a['description']}</p>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>LogDoc Incident & Analysis Report - {ds.name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 40px; line-height: 1.6; }}
        .container {{ max-width: 960px; margin: 0 auto; }}
        .header {{ border-bottom: 1px solid #334155; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }}
        .badge {{ background: #3b82f6; color: white; padding: 4px 12px; border-radius: 999px; font-size: 13px; font-weight: 600; }}
        .grid {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 30px; }}
        .card {{ background: #1e293b; padding: 20px; border-radius: 8px; border: 1px solid #334155; text-align: center; }}
        .card .val {{ font-size: 28px; font-weight: bold; margin-top: 8px; }}
        .card .lbl {{ color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }}
        .section-title {{ font-size: 20px; border-bottom: 1px solid #334155; padding-bottom: 8px; margin-top: 36px; margin-bottom: 16px; color: #38bdf8; }}
        .print-btn {{ background: #2563eb; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: 500; }}
        @media print {{ .print-btn {{ display: none; }} body {{ background: white; color: black; }} .card {{ border: 1px solid #ccc; background: #f8fafc; }} }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1 style="margin:0; font-size:26px;">🔍 LogDoc Diagnostic Report</h1>
                <div style="color: #94a3b8; margin-top: 4px;">Dataset: <strong>{ds.name}</strong> | Parser: <code>{ds.parser_type}</code></div>
            </div>
            <div>
                <button class="print-btn" onclick="window.print()">Print / Save PDF</button>
            </div>
        </div>

        <div class="grid">
            <div class="card">
                <div class="lbl">Total Log Events</div>
                <div class="val" style="color: #38bdf8;">{total:,}</div>
            </div>
            <div class="card">
                <div class="lbl">Total Errors</div>
                <div class="val" style="color: #ef4444;">{errors:,}</div>
            </div>
            <div class="card">
                <div class="lbl">Error Rate</div>
                <div class="val" style="color: #f59e0b;">{error_rate}%</div>
            </div>
            <div class="card">
                <div class="lbl">Anomalies Detected</div>
                <div class="val" style="color: #a855f7;">{len(ds.anomalies)}</div>
            </div>
        </div>

        <h2 class="section-title">Executive Summary</h2>
        <div style="background:#1e293b; padding:20px; border-radius:8px; border:1px solid #334155;">
            <p style="margin:0; font-size:16px;">{diag.get('executive_summary', '')}</p>
        </div>

        <h2 class="section-title">Diagnosed Incidents & Root Causes</h2>
        {issues_html if issues_html else "<p style='color:#94a3b8;'>No critical incident patterns identified.</p>"}

        <h2 class="section-title">Detected Anomalies & Alerts</h2>
        {anomalies_html if anomalies_html else "<p style='color:#94a3b8;'>No anomaly bursts identified.</p>"}

        <div style="text-align: center; color: #64748b; font-size: 13px; margin-top: 40px; border-top: 1px solid #334155; padding-top: 20px;">
            Generated by LogDoc Automated Log Diagnostics Platform • {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
        </div>
    </div>
</body>
</html>"""
    return HTMLResponse(content=html)

# Register routes under both /api and root /
app.include_router(router, prefix="/api")
app.include_router(router)

@app.get("/api")
def api_base_endpoint():
    return api_root()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await WS_MANAGER.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
            except Exception:
                pass
    except WebSocketDisconnect:
        WS_MANAGER.disconnect(websocket)
    except Exception:
        WS_MANAGER.disconnect(websocket)

from fastapi.staticfiles import StaticFiles

# Mount built frontend if available locally
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
