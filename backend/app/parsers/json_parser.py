import json
from typing import Optional, List, Dict, Any
from .base import BaseParser, LogEntry, normalize_log_level, parse_iso_or_common_date

class JsonParser(BaseParser):
    name = "json"

    TIMESTAMP_FIELDS = ["@timestamp", "timestamp", "time", "ts", "datetime", "date", "created_at"]
    LEVEL_FIELDS = ["level", "severity", "log_level", "lvl", "loglevel", "type"]
    MESSAGE_FIELDS = ["message", "msg", "log", "text", "event", "description", "details"]
    SERVICE_FIELDS = ["service", "service_name", "app", "application", "name", "component", "logger", "source"]

    def can_parse(self, lines: List[str]) -> float:
        valid_json_count = 0
        total_checked = 0
        for line in lines[:20]:
            clean = line.strip()
            if not clean:
                continue
            total_checked += 1
            if clean.startswith("{") and clean.endswith("}"):
                try:
                    data = json.loads(clean)
                    if isinstance(data, dict):
                        valid_json_count += 1
                except Exception:
                    pass
        if total_checked == 0:
            return 0.0
        return valid_json_count / total_checked

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        clean = line.strip()
        if not clean:
            return None
        try:
            data = json.loads(clean)
            if not isinstance(data, dict):
                return None
        except Exception:
            return None

        # Extract timestamp
        ts_val = None
        for f in self.TIMESTAMP_FIELDS:
            if f in data and data[f]:
                ts_val = str(data[f])
                break
        
        iso_ts, epoch_ts = parse_iso_or_common_date(ts_val) if ts_val else (None, None)

        # Extract level
        lvl_val = "INFO"
        for f in self.LEVEL_FIELDS:
            if f in data and data[f]:
                lvl_val = str(data[f])
                break
        normalized_lvl = normalize_log_level(lvl_val)

        # Extract message
        msg_val = ""
        for f in self.MESSAGE_FIELDS:
            if f in data and data[f] is not None:
                msg_val = str(data[f])
                break
        if not msg_val:
            # Fallback if no message field
            msg_val = json.dumps(data)

        # Extract service
        svc_val = None
        for f in self.SERVICE_FIELDS:
            if f in data and data[f]:
                svc_val = str(data[f])
                break

        # Metadata: all other fields
        reserved = set(self.TIMESTAMP_FIELDS + self.LEVEL_FIELDS + self.MESSAGE_FIELDS + self.SERVICE_FIELDS)
        metadata = {k: v for k, v in data.items() if k not in reserved}

        # Check for error indicators in metadata
        if "error" in metadata or "exception" in metadata or "stack_trace" in metadata:
            if normalized_lvl not in ["ERROR", "CRITICAL"]:
                normalized_lvl = "ERROR"

        return LogEntry(
            timestamp=iso_ts,
            timestamp_epoch=epoch_ts,
            level=normalized_lvl,
            service=svc_val,
            message=msg_val,
            raw=line,
            source=source,
            line_number=line_no,
            metadata=metadata
        )
