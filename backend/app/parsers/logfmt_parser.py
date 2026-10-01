import re
from typing import Optional, List, Dict, Any
from .base import BaseParser, LogEntry, normalize_log_level, parse_iso_or_common_date

class LogfmtParser(BaseParser):
    name = "logfmt"

    # Regex to match key=value or key="quoted string with spaces"
    PAIR_PATTERN = re.compile(r'([a-zA-Z0-9_.-]+)=(?:"([^"]*)"|(\S+))')

    TIMESTAMP_KEYS = ["ts", "time", "timestamp", "datetime", "date", "@timestamp"]
    LEVEL_KEYS = ["level", "lvl", "severity"]
    MESSAGE_KEYS = ["msg", "message", "event"]
    SERVICE_KEYS = ["service", "app", "caller", "source", "component"]

    def can_parse(self, lines: List[str]) -> float:
        valid_count = 0
        total = 0
        for line in lines[:20]:
            clean = line.strip()
            if not clean:
                continue
            total += 1
            pairs = self.PAIR_PATTERN.findall(clean)
            if len(pairs) >= 3:
                valid_count += 1
        return valid_count / total if total > 0 else 0.0

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        clean = line.strip()
        matches = self.PAIR_PATTERN.findall(clean)
        if not matches or len(matches) < 2:
            return None

        data: Dict[str, str] = {}
        for key, quoted_val, plain_val in matches:
            val = quoted_val if quoted_val != "" else plain_val
            data[key.lower()] = val

        # Extract timestamp
        ts_raw = None
        for k in self.TIMESTAMP_KEYS:
            if k in data:
                ts_raw = data[k]
                break
        iso_ts, epoch_ts = parse_iso_or_common_date(ts_raw) if ts_raw else (None, None)

        # Extract level
        lvl_raw = "INFO"
        for k in self.LEVEL_KEYS:
            if k in data:
                lvl_raw = data[k]
                break
        level = normalize_log_level(lvl_raw)

        # Extract message
        msg_raw = ""
        for k in self.MESSAGE_KEYS:
            if k in data:
                msg_raw = data[k]
                break
        if not msg_raw:
            msg_raw = clean

        # Extract service
        service = None
        for k in self.SERVICE_KEYS:
            if k in data:
                service = data[k]
                break

        reserved = set(self.TIMESTAMP_KEYS + self.LEVEL_KEYS + self.MESSAGE_KEYS + self.SERVICE_KEYS)
        metadata = {k: v for k, v in data.items() if k not in reserved}

        return LogEntry(
            timestamp=iso_ts,
            timestamp_epoch=epoch_ts,
            level=level,
            service=service,
            message=msg_raw,
            raw=line,
            source=source,
            line_number=line_no,
            metadata=metadata
        )
