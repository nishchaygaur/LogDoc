from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, Dict, Any, List, Iterator
import uuid
import re

@dataclass
class LogEntry:
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: Optional[str] = None
    timestamp_epoch: Optional[float] = None
    level: str = "INFO"
    service: Optional[str] = None
    message: str = ""
    raw: str = ""
    source: Optional[str] = None
    line_number: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    template_id: Optional[int] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "timestamp_epoch": self.timestamp_epoch,
            "level": self.level,
            "service": self.service,
            "message": self.message,
            "raw": self.raw,
            "source": self.source,
            "line_number": self.line_number,
            "metadata": self.metadata,
            "template_id": self.template_id,
        }

def normalize_log_level(level_raw: str) -> str:
    lvl = (level_raw or "").strip().upper()
    if lvl in ["E", "ERR", "ERROR", "FATAL", "CRIT", "CRITICAL", "SEVERE", "PANIC", "EMERG", "ALERT"]:
        return "ERROR"
    if lvl in ["W", "WARN", "WARNING"]:
        return "WARN"
    if lvl in ["I", "INFO", "INF", "NOTICE"]:
        return "INFO"
    if lvl in ["D", "DEBUG", "DBG"]:
        return "DEBUG"
    if lvl in ["T", "TRACE", "VERBOSE"]:
        return "TRACE"
    return "INFO"

COMMON_TIMESTAMP_FORMATS = [
    "%Y-%m-%dT%H:%M:%S.%fZ",
    "%Y-%m-%dT%H:%M:%S.%f%z",
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S.%f",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S,%f",
    "%Y-%m-%d %H:%M:%S.%f",
    "%Y-%m-%d %H:%M:%S",
    "%d/%b/%Y:%H:%M:%S %z",
    "%b %d %H:%M:%S",
    "%b  %d %H:%M:%S",
]

def parse_iso_or_common_date(date_str: str) -> tuple[Optional[str], Optional[float]]:
    if not date_str:
        return None, None
    clean_str = date_str.strip().strip("[]()")
    
    # Try ISO direct
    try:
        dt = datetime.fromisoformat(clean_str.replace("Z", "+00:00"))
        return dt.isoformat(), dt.timestamp()
    except Exception:
        pass

    current_year = datetime.now().year
    for fmt in COMMON_TIMESTAMP_FORMATS:
        try:
            dt = datetime.strptime(clean_str, fmt)
            if "%Y" not in fmt and "%y" not in fmt:
                dt = dt.replace(year=current_year)
            return dt.isoformat(), dt.timestamp()
        except Exception:
            continue

    return clean_str, None

class BaseParser:
    name: str = "base"

    def can_parse(self, lines: List[str]) -> float:
        """Returns confidence score between 0.0 and 1.0"""
        raise NotImplementedError

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        raise NotImplementedError

    def parse_lines(self, lines: List[str], source: Optional[str] = None) -> List[LogEntry]:
        entries: List[LogEntry] = []
        for idx, line in enumerate(lines, 1):
            if not line.strip():
                continue
            entry = self.parse_line(line, line_no=idx, source=source)
            if entry:
                entries.append(entry)
        return entries
