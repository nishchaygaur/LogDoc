from typing import List, Tuple, Optional
from .base import BaseParser, LogEntry
from .json_parser import JsonParser
from .regex_parsers import NginxApacheParser, SyslogParser, GenericStandardParser
from .springboot_parser import SpringBootParser
from .logfmt_parser import LogfmtParser

ALL_PARSERS: List[BaseParser] = [
    JsonParser(),
    SpringBootParser(),
    NginxApacheParser(),
    SyslogParser(),
    LogfmtParser(),
    GenericStandardParser(),
]

def detect_parser(lines: List[str]) -> Tuple[BaseParser, float]:
    best_parser: BaseParser = GenericStandardParser()
    best_score = 0.0

    for parser in ALL_PARSERS:
        score = parser.can_parse(lines)
        if score > best_score:
            best_score = score
            best_parser = parser

    # If even generic had low score, default to generic
    if best_score < 0.1:
        return GenericStandardParser(), 0.1
    return best_parser, best_score

def parse_raw_log_content(content: str, source_name: Optional[str] = None) -> Tuple[List[LogEntry], str]:
    lines = content.splitlines()
    if not lines:
        return [], "empty"

    parser, confidence = detect_parser(lines[:50])
    entries = parser.parse_lines(lines, source=source_name)
    
    # If parser returned very few entries compared to lines, try generic
    if len(entries) < len(lines) * 0.2 and parser.name != "generic_standard":
        fallback = GenericStandardParser()
        fallback_entries = fallback.parse_lines(lines, source=source_name)
        if len(fallback_entries) > len(entries):
            return fallback_entries, "generic_standard"

    return entries, parser.name
