import re
from typing import List, Dict, Any, Optional, Set
from .parsers.base import LogEntry
from .analytics.drain_clustering import DrainMiner
from .analytics.anomaly_detector import AnomalyDetector
from .analytics.metrics import compute_metrics

class LogDataset:
    def __init__(self, name: str, parser_type: str = "auto"):
        self.name = name
        self.parser_type = parser_type
        self.entries: List[LogEntry] = []
        self.entries_dict: List[Dict[str, Any]] = []
        
        # Analytics cache
        self.miner = DrainMiner()
        self.clusters: List[Dict[str, Any]] = []
        self.anomalies: List[Dict[str, Any]] = []
        self.metrics: Dict[str, Any] = {}
        self.is_analyzed = False

    def add_entries(self, new_entries: List[LogEntry]):
        for entry in new_entries:
            d = entry.to_dict()
            # Assign template_id via DrainMiner
            t_id = self.miner.add_log(d)
            entry.template_id = t_id
            d["template_id"] = t_id
            
            self.entries.append(entry)
            self.entries_dict.append(d)

        self.recalculate_analytics()

    def recalculate_analytics(self):
        self.clusters = self.miner.get_clusters_summary()
        self.metrics = compute_metrics(self.entries_dict)
        detector = AnomalyDetector()
        self.anomalies = detector.analyze(self.entries_dict, self.clusters)
        self.is_analyzed = True

    def filter_logs(
        self,
        query: Optional[str] = None,
        is_regex: bool = False,
        levels: Optional[List[str]] = None,
        services: Optional[List[str]] = None,
        template_id: Optional[int] = None,
        start_epoch: Optional[float] = None,
        end_epoch: Optional[float] = None,
        limit: int = 100,
        offset: int = 0,
        sort_order: str = "desc"  # 'desc' or 'asc'
    ) -> Dict[str, Any]:
        regex_compiled = None
        if query:
            if is_regex:
                try:
                    regex_compiled = re.compile(query, re.IGNORECASE)
                except re.error:
                    pass
            else:
                query_lower = query.lower()

        level_set: Optional[Set[str]] = set(lvl.upper() for lvl in levels) if levels else None
        service_set: Optional[Set[str]] = set(services) if services else None

        matched: List[Dict[str, Any]] = []

        for d in self.entries_dict:
            # Filter by level
            if level_set and d.get("level") not in level_set:
                continue

            # Filter by service
            if service_set and d.get("service") not in service_set:
                continue

            # Filter by template
            if template_id is not None and d.get("template_id") != template_id:
                continue

            # Filter by time
            ep = d.get("timestamp_epoch")
            if ep is not None:
                if start_epoch is not None and ep < start_epoch:
                    continue
                if end_epoch is not None and ep > end_epoch:
                    continue

            # Filter by query
            if query:
                if regex_compiled:
                    if not (regex_compiled.search(d.get("message", "")) or regex_compiled.search(d.get("raw", ""))):
                        continue
                else:
                    if query_lower not in d.get("message", "").lower() and query_lower not in d.get("raw", "").lower():
                        continue

            matched.append(d)

        # Sorting
        if sort_order == "desc":
            # Reverse order (newest first)
            results = matched[::-1]
        else:
            results = matched

        total_matched = len(results)
        paginated = results[offset : offset + limit]

        return {
            "total": total_matched,
            "limit": limit,
            "offset": offset,
            "logs": paginated
        }


class LogStore:
    def __init__(self):
        self.datasets: Dict[str, LogDataset] = {}
        self.active_dataset_id: Optional[str] = None

    def create_dataset(self, name: str, parser_type: str = "auto") -> LogDataset:
        dataset = LogDataset(name=name, parser_type=parser_type)
        self.datasets[name] = dataset
        self.active_dataset_id = name
        return dataset

    def get_dataset(self, name: Optional[str] = None) -> Optional[LogDataset]:
        if not name:
            name = self.active_dataset_id
        return self.datasets.get(name)

    def list_datasets(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": k,
                "name": v.name,
                "parser_type": v.parser_type,
                "log_count": len(v.entries),
                "is_active": k == self.active_dataset_id
            }
            for k, v in self.datasets.items()
        ]

GLOBAL_STORE = LogStore()
