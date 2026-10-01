import re
from typing import Optional, List, Dict, Any
from .base import BaseParser, LogEntry, normalize_log_level, parse_iso_or_common_date

class SpringBootParser(BaseParser):
    name = "springboot"

    # 2026-10-02 00:30:15.123  INFO 12345 --- [nio-8080-exec-1] c.e.service.PaymentService : Payment received
    SPRING_HEADER = re.compile(
        r'^(\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?)\s+(TRACE|DEBUG|INFO|WARN|ERROR|FATAL)\s+(\d+)\s+---\s+\[(.*?)\]\s+(\S+)\s*:\s*(.*)$'
    )

    def can_parse(self, lines: List[str]) -> float:
        matches = 0
        total = 0
        for line in lines[:20]:
            clean = line.strip()
            if not clean:
                continue
            total += 1
            if self.SPRING_HEADER.match(clean):
                matches += 1
        return matches / total if total > 0 else 0.0

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        match = self.SPRING_HEADER.match(line.strip())
        if not match:
            return None
        ts_str, lvl, pid, thread, logger, msg = match.groups()
        iso_ts, epoch_ts = parse_iso_or_common_date(ts_str)

        return LogEntry(
            timestamp=iso_ts,
            timestamp_epoch=epoch_ts,
            level=normalize_log_level(lvl),
            service=logger.split('.')[-1] if '.' in logger else logger,
            message=msg,
            raw=line,
            source=source,
            line_number=line_no,
            metadata={"pid": int(pid), "thread": thread, "logger": logger}
        )

    def parse_lines(self, lines: List[str], source: Optional[str] = None) -> List[LogEntry]:
        """Handles multi-line stack traces grouped into the parent log entry"""
        entries: List[LogEntry] = []
        current_entry: Optional[LogEntry] = None

        for idx, line in enumerate(lines, 1):
            if not line.strip():
                continue

            match = self.SPRING_HEADER.match(line.strip())
            if match:
                if current_entry:
                    entries.append(current_entry)
                current_entry = self.parse_line(line, line_no=idx, source=source)
            else:
                # Continuation line (stack trace, Caused by, etc.)
                if current_entry:
                    current_entry.raw += "\n" + line
                    current_entry.message += "\n" + line.strip()
                    if "stack_trace" not in current_entry.metadata:
                        current_entry.metadata["stack_trace"] = []
                    current_entry.metadata["stack_trace"].append(line.strip())
                else:
                    # Orphan line before first header
                    entries.append(LogEntry(
                        level="INFO",
                        message=line.strip(),
                        raw=line,
                        source=source,
                        line_number=idx
                    ))

        if current_entry:
            entries.append(current_entry)

        return entries
