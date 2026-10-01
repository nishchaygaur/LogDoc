import re
from typing import Optional, List, Dict, Any
from .base import BaseParser, LogEntry, normalize_log_level, parse_iso_or_common_date

class NginxApacheParser(BaseParser):
    name = "nginx_apache"

    # Combined / Common access log regex
    PATTERN = re.compile(
        r'^(\S+)\s+(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+"([A-Z]+)\s+([^"]*?)(?:\s+HTTP\/[\d\.]+)?\"\s+(\d{3})\s+(\d+|-)(?:\s+"([^"]*)"\s*"([^"]*)")?'
    )

    def can_parse(self, lines: List[str]) -> float:
        matches = 0
        total = 0
        for line in lines[:20]:
            clean = line.strip()
            if not clean:
                continue
            total += 1
            if self.PATTERN.match(clean):
                matches += 1
        return matches / total if total > 0 else 0.0

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        match = self.PATTERN.match(line.strip())
        if not match:
            return None

        ip, ident, auth_user, ts_raw, method, path, status_str, bytes_str, referrer, user_agent = match.groups()
        iso_ts, epoch_ts = parse_iso_or_common_date(ts_raw)
        status_code = int(status_str)

        level = "INFO"
        if status_code >= 500:
            level = "ERROR"
        elif status_code >= 400:
            level = "WARN"

        msg = f"{method} {path} HTTP {status_code}"
        metadata: Dict[str, Any] = {
            "client_ip": ip,
            "http_method": method,
            "http_path": path,
            "status_code": status_code,
            "bytes_sent": int(bytes_str) if bytes_str and bytes_str != "-" else 0,
        }
        if referrer and referrer != "-":
            metadata["referrer"] = referrer
        if user_agent and user_agent != "-":
            metadata["user_agent"] = user_agent
        if auth_user and auth_user != "-":
            metadata["auth_user"] = auth_user

        return LogEntry(
            timestamp=iso_ts,
            timestamp_epoch=epoch_ts,
            level=level,
            service="web-server",
            message=msg,
            raw=line,
            source=source,
            line_number=line_no,
            metadata=metadata
        )


class SyslogParser(BaseParser):
    name = "syslog"

    # RFC 3164: Oct 11 22:14:15 mymachine su[123]: 'su root' failed for lonvick
    RFC3164_PATTERN = re.compile(
        r'^([A-Z][a-z]{2}\s+\d+\s+\d{2}:\d{2}:\d{2})\s+([a-zA-Z0-9_\.-]+)\s+([a-zA-Z0-9_\.\-\/]+)(?:\[(\d+)\])?:\s+(.*)$'
    )
    
    # RFC 5424: <165>1 2003-10-11T22:14:15.003Z mymachine.example.com evntslog - ID47 [exampleSDID@32473 iut="3"] message
    RFC5424_PATTERN = re.compile(
        r'^<(\d+)>(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(?:\[(.*?)\])?\s*(.*)$'
    )

    def can_parse(self, lines: List[str]) -> float:
        matches = 0
        total = 0
        for line in lines[:20]:
            clean = line.strip()
            if not clean:
                continue
            total += 1
            if self.RFC3164_PATTERN.match(clean) or self.RFC5424_PATTERN.match(clean):
                matches += 1
        return matches / total if total > 0 else 0.0

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        clean = line.strip()
        
        # Check RFC 5424 first
        m5424 = self.RFC5424_PATTERN.match(clean)
        if m5424:
            pri, ver, ts, host, app, proc_id, msg_id, sd, msg = m5424.groups()
            iso_ts, epoch_ts = parse_iso_or_common_date(ts)
            pri_num = int(pri)
            severity = pri_num % 8
            # 0: Emerg, 1: Alert, 2: Crit, 3: Err, 4: Warning, 5: Notice, 6: Info, 7: Debug
            level_map = {0: "CRITICAL", 1: "CRITICAL", 2: "CRITICAL", 3: "ERROR", 4: "WARN", 5: "INFO", 6: "INFO", 7: "DEBUG"}
            lvl = level_map.get(severity, "INFO")
            
            return LogEntry(
                timestamp=iso_ts,
                timestamp_epoch=epoch_ts,
                level=lvl,
                service=app if app != "-" else host,
                message=msg or "",
                raw=line,
                source=source,
                line_number=line_no,
                metadata={"host": host, "proc_id": proc_id, "msg_id": msg_id, "facility": pri_num // 8}
            )

        # Check RFC 3164
        m3164 = self.RFC3164_PATTERN.match(clean)
        if m3164:
            ts, host, proc, pid, msg = m3164.groups()
            iso_ts, epoch_ts = parse_iso_or_common_date(ts)
            
            # Infer level from message content keywords
            lvl = "INFO"
            low_msg = msg.lower()
            if any(k in low_msg for k in ["failed", "error", "fatal", "critical", "denied", "segfault", "panic"]):
                lvl = "ERROR"
            elif any(k in low_msg for k in ["warn", "warning"]):
                lvl = "WARN"

            metadata = {"host": host}
            if pid:
                metadata["pid"] = int(pid)

            return LogEntry(
                timestamp=iso_ts,
                timestamp_epoch=epoch_ts,
                level=lvl,
                service=proc,
                message=msg,
                raw=line,
                source=source,
                line_number=line_no,
                metadata=metadata
            )

        return None


class GenericStandardParser(BaseParser):
    name = "generic_standard"

    # Matches lines like:
    # 2026-10-02 00:30:15 [INFO] [order-service] Payment succeeded for order #1234
    # 2026-10-02T00:30:15.123Z ERROR user-auth: Invalid JWT token
    PATTERN = re.compile(
        r'^\[?(\d{4}[-/.]\d{2}[-/.]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:\s?[Z+-]\d{2}:?\d{2})?)\]?\s*(?:\[([^\]]+)\])?\s*(?:\[?(TRACE|DEBUG|INFO|WARN|WARNING|ERROR|FATAL|CRITICAL)\]?)?\s*(?:\[([^\]]+)\])?\s*(?:[-:>|]\s*|\s+)(.*)$',
        re.IGNORECASE
    )

    def can_parse(self, lines: List[str]) -> float:
        matches = 0
        total = 0
        for line in lines[:20]:
            clean = line.strip()
            if not clean:
                continue
            total += 1
            if self.PATTERN.match(clean):
                matches += 1
        return matches / total if total > 0 else 0.0

    def parse_line(self, line: str, line_no: int = 0, source: Optional[str] = None) -> Optional[LogEntry]:
        match = self.PATTERN.match(line.strip())
        if not match:
            # Fallback loose line parser
            return None

        ts_str, tag1, lvl_str, tag2, msg = match.groups()
        iso_ts, epoch_ts = parse_iso_or_common_date(ts_str)
        
        # Decide service and level
        service = None
        if tag1 and not lvl_str and normalize_log_level(tag1) in ["INFO", "WARN", "ERROR", "DEBUG", "TRACE"]:
            lvl_str = tag1
        elif tag1:
            service = tag1
        
        if tag2 and not service:
            service = tag2

        level = normalize_log_level(lvl_str) if lvl_str else "INFO"

        return LogEntry(
            timestamp=iso_ts,
            timestamp_epoch=epoch_ts,
            level=level,
            service=service,
            message=msg.strip() if msg else "",
            raw=line,
            source=source,
            line_number=line_no,
            metadata={}
        )
