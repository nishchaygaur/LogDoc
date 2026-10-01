from typing import List, Dict, Any, Optional
from collections import defaultdict
import math

def compute_metrics(entries: List[Dict[str, Any]], num_histogram_buckets: int = 40) -> Dict[str, Any]:
    if not entries:
        return {
            "total_logs": 0,
            "level_counts": {},
            "error_rate": 0.0,
            "services": [],
            "top_errors": [],
            "histogram": [],
            "time_range": {"start": None, "end": None, "duration_seconds": 0}
        }

    total = len(entries)
    level_counts: Dict[str, int] = defaultdict(int)
    service_counts: Dict[str, int] = defaultdict(int)
    error_counts: Dict[str, int] = defaultdict(int)

    epochs = []
    for e in entries:
        lvl = e.get("level", "INFO")
        level_counts[lvl] += 1
        
        svc = e.get("service") or "unspecified"
        service_counts[svc] += 1

        if lvl in ["ERROR", "CRITICAL"]:
            msg = (e.get("message") or "")[:150]
            error_counts[msg] += 1

        ep = e.get("timestamp_epoch")
        if ep is not None:
            epochs.append(ep)

    error_total = level_counts.get("ERROR", 0) + level_counts.get("CRITICAL", 0)
    error_rate = round((error_total / total) * 100, 2) if total > 0 else 0.0

    # Sort services
    top_services = [
        {"name": k, "count": v, "percentage": round((v / total) * 100, 1)}
        for k, v in sorted(service_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # Top errors
    top_errors = [
        {"message": k, "count": v}
        for k, v in sorted(error_counts.items(), key=lambda x: x[1], reverse=True)[:10]
    ]

    # Time-series histogram
    histogram = []
    time_range = {"start": None, "end": None, "duration_seconds": 0}

    if epochs:
        min_epoch = min(epochs)
        max_epoch = max(epochs)
        duration = max_epoch - min_epoch
        time_range["duration_seconds"] = round(duration, 1)

        # Find corresponding ISO strings
        for e in entries:
            if e.get("timestamp_epoch") == min_epoch and not time_range["start"]:
                time_range["start"] = e.get("timestamp")
            if e.get("timestamp_epoch") == max_epoch and not time_range["end"]:
                time_range["end"] = e.get("timestamp")

        bucket_size = max(1.0, duration / num_histogram_buckets) if duration > 0 else 1.0
        buckets = [
            {"timestamp_epoch": min_epoch + i * bucket_size, "total": 0, "INFO": 0, "WARN": 0, "ERROR": 0, "DEBUG": 0, "OTHER": 0}
            for i in range(num_histogram_buckets + 1)
        ]

        for e in entries:
            ep = e.get("timestamp_epoch")
            if ep is None:
                continue
            b_idx = min(int((ep - min_epoch) / bucket_size), num_histogram_buckets)
            lvl = e.get("level", "INFO")
            buckets[b_idx]["total"] += 1
            if lvl in ["INFO", "WARN", "ERROR", "DEBUG"]:
                buckets[b_idx][lvl] += 1
            elif lvl == "CRITICAL":
                buckets[b_idx]["ERROR"] += 1
            else:
                buckets[b_idx]["OTHER"] += 1

        histogram = buckets

    return {
        "total_logs": total,
        "level_counts": dict(level_counts),
        "error_rate": error_rate,
        "services": top_services,
        "top_errors": top_errors,
        "histogram": histogram,
        "time_range": time_range
    }
