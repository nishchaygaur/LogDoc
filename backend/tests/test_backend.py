import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.parsers.json_parser import JsonParser
from backend.app.parsers.regex_parsers import NginxApacheParser, SyslogParser, GenericStandardParser
from backend.app.parsers.springboot_parser import SpringBootParser
from backend.app.parsers.logfmt_parser import LogfmtParser
from backend.app.parsers.detector import parse_raw_log_content
from backend.app.analytics.drain_clustering import DrainMiner
from backend.app.analytics.anomaly_detector import AnomalyDetector
from backend.app.analytics.metrics import compute_metrics
from backend.app.analytics.ai_diagnostics import analyze_with_heuristics

client = TestClient(app)

def test_json_parser():
    parser = JsonParser()
    line = '{"timestamp":"2026-10-02T00:30:15Z","level":"error","service":"payment","message":"Charge failed","status":500}'
    entry = parser.parse_line(line)
    assert entry is not None
    assert entry.level == "ERROR"
    assert entry.service == "payment"
    assert "Charge failed" in entry.message
    assert entry.metadata.get("status") == 500

def test_nginx_parser():
    parser = NginxApacheParser()
    line = '192.168.1.50 - - [02/Oct/2026:00:30:15 +0000] "GET /api/v1/users HTTP/1.1" 200 4523 "https://google.com" "Mozilla/5.0"'
    assert parser.can_parse([line]) > 0.5
    entry = parser.parse_line(line)
    assert entry is not None
    assert entry.metadata["client_ip"] == "192.168.1.50"
    assert entry.metadata["status_code"] == 200
    assert entry.level == "INFO"

def test_syslog_parser():
    parser = SyslogParser()
    line = 'Oct  2 00:30:15 srv-edge-01 sshd[1234]: Failed password for root from 203.0.113.42 port 54322 ssh2'
    entry = parser.parse_line(line)
    assert entry is not None
    assert entry.level == "ERROR"
    assert "Failed password" in entry.message

def test_springboot_parser():
    parser = SpringBootParser()
    lines = [
        "2026-10-02 00:30:15.123 ERROR 12345 --- [nio-8080-exec-1] c.e.orders.OrderService : Order failed",
        "java.lang.NullPointerException: user is null",
        "\tat com.example.orders.OrderService.process(OrderService.java:42)"
    ]
    entries = parser.parse_lines(lines)
    assert len(entries) == 1
    assert "NullPointerException" in entries[0].message
    assert entries[0].level == "ERROR"

def test_logfmt_parser():
    parser = LogfmtParser()
    line = 'ts=2026-10-02T00:30:15Z level=warn service=catalog-svc msg="Cache missed for item" key=9482'
    entry = parser.parse_line(line)
    assert entry is not None
    assert entry.level == "WARN"
    assert entry.service == "catalog-svc"
    assert entry.metadata.get("key") == "9482"

def test_drain_clustering():
    miner = DrainMiner()
    l1 = {"message": "User 101 logged in from IP 192.168.1.1", "level": "INFO"}
    l2 = {"message": "User 202 logged in from IP 192.168.1.2", "level": "INFO"}
    t1 = miner.add_log(l1)
    t2 = miner.add_log(l2)
    assert t1 == t2
    summary = miner.get_clusters_summary()
    assert len(summary) == 1
    assert summary[0]["size"] == 2

def test_fastapi_endpoints():
    with TestClient(app) as test_client:
        r = test_client.get("/api/health")
        assert r.status_code == 200
        assert r.json()["status"] == "healthy"

        r = test_client.get("/api/datasets")
        assert r.status_code == 200
        assert "datasets" in r.json()

        r = test_client.get("/api/logs?limit=10")
        assert r.status_code == 200
        data = r.json()
        assert "logs" in data
        assert len(data["logs"]) > 0

        r = test_client.get("/api/metrics")
        assert r.status_code == 200
        assert "level_counts" in r.json()

        r = test_client.get("/api/clusters")
        assert r.status_code == 200
        assert "clusters" in r.json()

        r = test_client.get("/api/anomalies")
        assert r.status_code == 200
        assert "anomalies" in r.json()

        r = test_client.post("/api/diagnostics", json={"dataset": "microservices_outage"})
        assert r.status_code == 200
        assert "executive_summary" in r.json()

        r = test_client.get("/api/export/report")
        assert r.status_code == 200
        assert "<!DOCTYPE html>" in r.text

def test_upload_full_payload_and_client_diagnostics():
    with TestClient(app) as test_client:
        sample_log = (
            "2026-10-02 10:00:00 [ERROR] auth-service: Failed password for admin from 10.0.0.1\n"
            "2026-10-02 10:00:01 [WARN] auth-service: Rate limit threshold approaching for 10.0.0.1\n"
            "2026-10-02 10:00:02 [INFO] auth-service: Healthcheck OK\n"
        )
        files = {"file": ("auth_test.log", sample_log.encode("utf-8"), "text/plain")}
        r = test_client.post("/api/upload", files=files)
        assert r.status_code == 200
        res = r.json()
        assert res["status"] == "success"
        assert res["total_parsed"] == 3
        assert "logs" in res
        assert len(res["logs"]) == 3
        assert "clusters" in res
        assert "anomalies" in res
        assert "metrics" in res
        assert res["metrics"]["total_logs"] == 3

        # Test diagnostics endpoint with client-supplied context
        diag_payload = {
            "error_samples": res["logs"],
            "anomalies": res["anomalies"],
            "metrics": res["metrics"]
        }
        r_diag = test_client.post("/api/diagnostics", json=diag_payload)
        assert r_diag.status_code == 200
        diag_res = r_diag.json()
        assert "executive_summary" in diag_res
        assert "diagnosed_issues" in diag_res

