from typing import List, Dict, Any, Optional
from datetime import datetime
import math
from collections import defaultdict

class AnomalyDetector:
    def __init__(self, time_bucket_seconds: int = 60):
        self.time_bucket_seconds = time_bucket_seconds

    def analyze(self, entries: List[Dict[str, Any]], clusters: List[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        anomalies: List[Dict[str, Any]] = []
        if not entries:
            return anomalies

        # 1. Bucket entries by time
        valid_epochs = [e["timestamp_epoch"] for e in entries if e.get("timestamp_epoch") is not None]
        if len(valid_epochs) >= 5:
            min_epoch = min(valid_epochs)
            max_epoch = max(valid_epochs)
            duration = max_epoch - min_epoch

            # Dynamically choose bucket size
            bucket_sec = max(5, int(duration / 30)) if duration > 0 else 60

            buckets: Dict[int, Dict[str, Any]] = defaultdict(lambda: {
                "total": 0, "errors": 0, "warnings": 0,
                "timestamp_start": None, "services": defaultdict(int),
                "error_messages": []
            })

            for e in entries:
                ep = e.get("timestamp_epoch")
                if ep is None:
                    continue
                b_idx = int((ep - min_epoch) // bucket_sec)
                b = buckets[b_idx]
                b["total"] += 1
                if not b["timestamp_start"]:
                    b["timestamp_start"] = e.get("timestamp")
                
                lvl = e.get("level", "INFO")
                if lvl in ["ERROR", "CRITICAL"]:
                    b["errors"] += 1
                    if len(b["error_messages"]) < 3:
                        b["error_messages"].append(e.get("message", "")[:120])
                elif lvl == "WARN":
                    b["warnings"] += 1

                svc = e.get("service")
                if svc:
                    b["services"][svc] += 1

            sorted_indices = sorted(buckets.keys())
            total_counts = [buckets[i]["total"] for i in sorted_indices]
            error_counts = [buckets[i]["errors"] for i in sorted_indices]

            # Calculate means and std deviations
            avg_total = sum(total_counts) / len(total_counts) if total_counts else 0
            avg_errors = sum(error_counts) / len(error_counts) if error_counts else 0

            variance_errors = sum((x - avg_errors) ** 2 for x in error_counts) / len(error_counts) if error_counts else 0
            std_errors = math.sqrt(variance_errors)

            # Error spike detection (z-score > 2.0 or sudden error rate > 30% when baseline is low)
            for idx in sorted_indices:
                b = buckets[idx]
                err_count = b["errors"]
                tot_count = b["total"]
                err_rate = (err_count / tot_count) if tot_count > 0 else 0

                is_spike = False
                severity = "medium"
                
                if std_errors > 0 and (err_count - avg_errors) / std_errors > 2.0 and err_count >= 3:
                    is_spike = True
                    severity = "high"
                elif err_rate > 0.35 and err_count >= 3:
                    is_spike = True
                    severity = "critical" if err_rate > 0.6 else "high"

                if is_spike:
                    top_services = sorted(b["services"].items(), key=lambda x: x[1], reverse=True)[:3]
                    anomalies.append({
                        "id": f"spike-{idx}",
                        "type": "ERROR_BURST",
                        "severity": severity,
                        "title": f"Sudden Error Spike ({err_count} errors, {err_rate*100:.1f}% error rate)",
                        "timestamp": b["timestamp_start"],
                        "description": f"Log volume had {tot_count} events with {err_count} errors in this window. Top affected services: {', '.join(s[0] for s in top_services) if top_services else 'N/A'}.",
                        "sample_errors": b["error_messages"],
                        "metric_value": err_count,
                        "baseline_value": round(avg_errors, 1)
                    })

        # 2. HTTP Status Code Outliers (e.g. 502/503/500 storms or 401 brute-force)
        http_errors = defaultdict(int)
        http_ips = defaultdict(lambda: defaultdict(int))
        for e in entries:
            meta = e.get("metadata", {})
            sc = meta.get("status_code")
            ip = meta.get("client_ip")
            if sc:
                if sc >= 500:
                    http_errors[f"HTTP {sc}"] += 1
                elif sc in [401, 403, 429]:
                    http_errors[f"HTTP {sc}"] += 1
                    if ip:
                        http_ips[sc][ip] += 1

        for sc_name, count in http_errors.items():
            if count >= 5:
                sev = "critical" if "50" in sc_name else "high"
                desc = f"Detected {count} instances of {sc_name} responses across the logged duration."
                anomalies.append({
                    "id": f"http-{sc_name}",
                    "type": "HTTP_STATUS_OUTLIER",
                    "severity": sev,
                    "title": f"High Volume of {sc_name} Responses",
                    "timestamp": entries[0].get("timestamp"),
                    "description": desc,
                    "sample_errors": [],
                    "metric_value": count,
                    "baseline_value": 0
                })

        # 3. Check for Security Brute Force (e.g. repeated 401s or failed auth messages from single IP or user)
        auth_failures = defaultdict(int)
        for e in entries:
            msg_lower = (e.get("message") or "").lower()
            if any(term in msg_lower for term in ["failed password", "authentication failure", "invalid credentials", "login failed", "unauthorized"]):
                meta = e.get("metadata", {})
                ip = meta.get("client_ip") or meta.get("host") or "unknown_source"
                auth_failures[ip] += 1

        for src, fail_count in auth_failures.items():
            if fail_count >= 4:
                anomalies.append({
                    "id": f"auth-fail-{src}",
                    "type": "SECURITY_AUTHENTICATION_SPIKE",
                    "severity": "critical" if fail_count >= 10 else "high",
                    "title": f"Possible Brute Force / Repeated Auth Failures ({fail_count} attempts)",
                    "timestamp": entries[0].get("timestamp"),
                    "description": f"Target source '{src}' recorded {fail_count} failed authentication events in the dataset.",
                    "sample_errors": [],
                    "metric_value": fail_count,
                    "baseline_value": 1
                })

        # 4. Check for Rare Error Signatures in Clusters
        if clusters:
            for c in clusters:
                if c.get("error_count", 0) > 0 and c.get("size", 0) <= 2 and len(entries) > 50:
                    anomalies.append({
                        "id": f"rare-cluster-{c['cluster_id']}",
                        "type": "RARE_ERROR_TEMPLATE",
                        "severity": "low",
                        "title": f"Rare Error Signature (Seen only {c['size']} time{'s' if c['size'] > 1 else ''})",
                        "timestamp": c.get("first_seen"),
                        "description": f"New or rare error template encountered: '{c.get('template')[:100]}'",
                        "sample_errors": [s.get("message", "")[:120] for s in c.get("sample_logs", [])],
                        "metric_value": c.get("size"),
                        "baseline_value": 0
                    })

        return anomalies
