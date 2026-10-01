import os
import re
from typing import List, Dict, Any, Optional

try:
    from google import genai
    from google.genai import types
    HAVE_GEMINI = True
except ImportError:
    HAVE_GEMINI = False

KNOWN_INCIDENT_PATTERNS = [
    {
        "category": "DATABASE_FAILURE",
        "patterns": [r"connection refused", r"pool exhausted", r"could not obtain connection", r"deadlock", r"psycopg2\.operationalerror", r"hikari.*timeout"],
        "title": "Database Connectivity / Connection Pool Exhaustion",
        "root_cause": "The application backend is unable to acquire or maintain connections to the database. This is typically caused by connection pool saturation, network partition, or the database server rejecting incoming connections under high load.",
        "remediation": [
            "Check database active connections and max_connections limit.",
            "Verify network reachability and database latency metrics.",
            "Inspect application connection pool sizing (e.g. HikariCP, PgPool) and leak detection thresholds.",
            "Look for unclosed transactions or long-running database queries blocking the pool."
        ]
    },
    {
        "category": "MEMORY_EXHAUSTION",
        "patterns": [r"outofmemoryerror", r"java heap space", r"oomkilled", r"gc overhead limit exceeded", r"memory error"],
        "title": "Application Memory Saturation / OOM Crash",
        "root_cause": "Process ran out of heap/virtual memory. Garbage collector was unable to reclaim sufficient space, leading to degraded throughput or SIGKILL termination.",
        "remediation": [
            "Inspect heap dumps for memory leaks in large caches or unclosed streams.",
            "Review recent deployments for unbounded memory allocations.",
            "Adjust JVM `-Xmx` or container memory limits in Kubernetes manifest.",
            "Enable Prometheus / CloudWatch memory metrics alerts before reaching 85% utilization."
        ]
    },
    {
        "category": "CASCADING_TIMEOUT",
        "patterns": [r"gateway timeout", r"504 gateway", r"502 bad gateway", r"connect timed out", r"read timed out", r"circuit breaker open"],
        "title": "Cascading Microservice Timeout / Upstream Degradation",
        "root_cause": "An upstream dependency or downstream microservice failed to respond within the configured timeout window, causing cascading request backpressure and gateway timeouts (HTTP 502/504).",
        "remediation": [
            "Identify the slowest upstream microservice in the distributed trace.",
            "Verify circuit breaker thresholds and fallback behaviors.",
            "Check downstream CPU/memory saturation or thread starvation.",
            "Implement exponential backoff with jitter on retry policies."
        ]
    },
    {
        "category": "SECURITY_ATTACK",
        "patterns": [r"failed password", r"invalid jwt", r"unauthorized", r"forbidden", r"signature verification failed", r"rate limit exceeded", r"401 unauthorized"],
        "title": "Security Anomaly / Credential Stuffing / Auth Failures",
        "root_cause": "Abnormal volume of failed authentications, expired/tampered JWT tokens, or repeated unauthorized access attempts targeting API endpoints.",
        "remediation": [
            "Inspect the offending client IPs and cross-reference with threat intelligence.",
            "Enforce IP rate limiting (WAF / Cloudflare / Nginx limit_req).",
            "Verify if key rotation occurred causing legitimate token invalidation.",
            "Enable MFA and trigger CAPTCHA challenges for repeated login failures."
        ]
    },
    {
        "category": "NULL_OR_TYPE_ERROR",
        "patterns": [r"nullpointerexception", r"attributeerror: 'nonetype'", r"cannot read propert.*of (?:null|undefined)", r"typeerror: Cannot read"],
        "title": "Unhandled Null Reference / Missing Data Contract",
        "root_cause": "An expected object or dictionary key was null/None at runtime. Usually indicates an unhandled edge case, schema mismatch with upstream payloads, or missing validation.",
        "remediation": [
            "Inspect the call stack to identify the exact line where variable was uninitialized.",
            "Add defensive null-checks or schema validation (Pydantic / TypeScript guard).",
            "Verify upstream payload backwards compatibility."
        ]
    }
]

def analyze_with_heuristics(
    entries: List[Dict[str, Any]],
    top_errors: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    metrics: Dict[str, Any]
) -> Dict[str, Any]:
    matched_issues = []
    affected_services = set()
    sample_snippets = []

    # Combine all error messages for keyword scanning
    error_texts = [e.get("message", "") for e in entries if e.get("level") in ["ERROR", "CRITICAL"]]
    raw_blob = " \n ".join(error_texts[:200]).lower()

    for pattern_def in KNOWN_INCIDENT_PATTERNS:
        match_count = 0
        matching_snippets = []
        for pat in pattern_def["patterns"]:
            rgx = re.compile(pat, re.IGNORECASE)
            for err in error_texts[:100]:
                if rgx.search(err):
                    match_count += 1
                    if len(matching_snippets) < 3:
                        matching_snippets.append(err[:200])

        if match_count > 0:
            confidence = min(0.98, 0.6 + (match_count * 0.05))
            matched_issues.append({
                "category": pattern_def["category"],
                "title": pattern_def["title"],
                "confidence": round(confidence, 2),
                "occurrences": match_count,
                "root_cause": pattern_def["root_cause"],
                "remediation": pattern_def["remediation"],
                "sample_snippets": matching_snippets
            })

    # Collect affected services
    for e in entries:
        if e.get("level") in ["ERROR", "CRITICAL"] and e.get("service"):
            affected_services.add(e.get("service"))

    total_errors = metrics.get("level_counts", {}).get("ERROR", 0) + metrics.get("level_counts", {}).get("CRITICAL", 0)
    error_rate = metrics.get("error_rate", 0.0)

    # Determine primary diagnosis
    if matched_issues:
        matched_issues.sort(key=lambda x: (x["confidence"], x["occurrences"]), reverse=True)
        primary = matched_issues[0]
        exec_summary = (
            f"Analysis of {metrics.get('total_logs', 0)} log entries detected an active incident with "
            f"{total_errors} errors ({error_rate}% error rate). The primary suspected root cause is "
            f"'{primary['title']}' affecting services: {', '.join(list(affected_services)[:4]) or 'unknown'}. "
            f"{primary['root_cause']}"
        )
    elif total_errors > 0:
        exec_summary = (
            f"Detected {total_errors} errors ({error_rate}% error rate) across {len(affected_services)} services. "
            f"Errors contain custom application exceptions. Review the top error traces below."
        )
    else:
        exec_summary = f"No critical errors or anomalies detected across {metrics.get('total_logs', 0)} log events. Systems operating within normal parameters."

    return {
        "source": "heuristic_engine",
        "executive_summary": exec_summary,
        "diagnosed_issues": matched_issues,
        "affected_services": list(affected_services),
        "total_errors": total_errors,
        "error_rate": error_rate,
        "anomalies_detected": len(anomalies),
        "gemini_available": HAVE_GEMINI
    }


async def analyze_with_gemini(
    api_key: str,
    entries: List[Dict[str, Any]],
    top_errors: List[Dict[str, Any]],
    anomalies: List[Dict[str, Any]],
    metrics: Dict[str, Any]
) -> Dict[str, Any]:
    if not HAVE_GEMINI:
        res = analyze_with_heuristics(entries, top_errors, anomalies, metrics)
        res["note"] = "google-genai SDK not available; returned heuristic diagnostics."
        return res

    client = genai.Client(api_key=api_key)

    # Prepare context summary
    error_samples = [e.get("raw") or e.get("message") for e in entries if e.get("level") in ["ERROR", "CRITICAL"]][:30]
    sample_text = "\n".join(f"- {s[:250]}" for s in error_samples)

    prompt = f"""
You are an expert Principal Site Reliability Engineer (SRE) and Systems Architect.
Analyze the following telemetry and log dataset diagnostics:

METRICS:
- Total logs analyzed: {metrics.get('total_logs')}
- Error count: {metrics.get('level_counts', {}).get('ERROR', 0)}
- Error rate: {metrics.get('error_rate')}%
- Time span: {metrics.get('time_range', {}).get('duration_seconds')} seconds
- Top affected services: {[s['name'] for s in metrics.get('services', [])[:5]]}
- Detected anomalies count: {len(anomalies)}

TOP LOG ERRORS & SAMPLES:
{sample_text if sample_text else "No severe error samples"}

DETECTED ANOMALY ALERTS:
{anomalies[:5]}

Provide a structured, professional incident diagnosis with:
1. Executive Incident Summary (2-3 concise sentences)
2. Suspected Root Cause (Technical deep dive)
3. Impact Assessment (Services affected, user impact)
4. Step-by-Step Remediation Plan (Immediate mitigation + long-term fix)
"""

    try:
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )
        heuristic = analyze_with_heuristics(entries, top_errors, anomalies, metrics)
        return {
            "source": "gemini_ai",
            "model": "gemini-2.5-flash",
            "executive_summary": response.text,
            "diagnosed_issues": heuristic["diagnosed_issues"],
            "affected_services": heuristic["affected_services"],
            "total_errors": heuristic["total_errors"],
            "error_rate": heuristic["error_rate"],
            "anomalies_detected": len(anomalies),
            "gemini_available": True
        }
    except Exception as e:
        heuristic = analyze_with_heuristics(entries, top_errors, anomalies, metrics)
        heuristic["note"] = f"Gemini API call failed ({str(e)}), used heuristic diagnosis."
        return heuristic
