import re
from typing import List, Dict, Any, Optional
from collections import defaultdict

class DrainCluster:
    def __init__(self, cluster_id: int, template_tokens: List[str]):
        self.cluster_id = cluster_id
        self.template_tokens = template_tokens
        self.size = 0
        self.error_count = 0
        self.sample_logs: List[Dict[str, Any]] = []
        self.first_seen: Optional[str] = None
        self.last_seen: Optional[str] = None
        self.sample_params: List[List[str]] = []

    @property
    def template(self) -> str:
        return " ".join(self.template_tokens)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "cluster_id": self.cluster_id,
            "template": self.template,
            "size": self.size,
            "error_count": self.error_count,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "sample_logs": self.sample_logs[:5],
            "sample_params": self.sample_params[:5],
        }


class DrainMiner:
    """
    Fast online log template miner inspired by the Drain algorithm.
    Groups log messages into structured templates by replacing variables with `<*>`.
    """

    # Regex masks for common variables
    VARIABLE_REGEXES = [
        (re.compile(r'\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b'), '<UUID>'),
        (re.compile(r'\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b'), '<IP>'),
        (re.compile(r'0x[0-9a-fA-F]+'), '<HEX>'),
        (re.compile(r'\b[0-9a-fA-F]{16,64}\b'), '<HASH>'),
        (re.compile(r'\b\d+\b'), '<NUM>'),
        (re.compile(r'(https?://\S+)'), '<URL>'),
        (re.compile(r'(/[\w.-]+)+/?'), '<PATH>'),
    ]

    def __init__(self, depth: int = 4, similarity_threshold: float = 0.5):
        self.depth = depth
        self.similarity_threshold = similarity_threshold
        self.clusters: List[DrainCluster] = []
        self._next_id = 1

    def preprocess(self, message: str) -> str:
        text = message.strip()
        for regex, mask in self.VARIABLE_REGEXES:
            text = regex.sub(mask, text)
        return text

    def tokenize(self, text: str) -> List[str]:
        return text.split()

    def get_similarity(self, tokens1: List[str], tokens2: List[str]) -> float:
        if len(tokens1) != len(tokens2):
            return 0.0
        if not tokens1:
            return 1.0

        matches = 0
        for t1, t2 in zip(tokens1, tokens2):
            if t1 == "<*>" or t2 == "<*>" or t1 == t2:
                matches += 1
        return matches / len(tokens1)

    def add_log(self, entry_dict: Dict[str, Any]) -> int:
        raw_msg = entry_dict.get("message", "")
        preprocessed = self.preprocess(raw_msg)
        tokens = self.tokenize(preprocessed)
        msg_len = len(tokens)

        best_cluster: Optional[DrainCluster] = None
        best_sim = -1.0

        # Find best matching cluster with same token length
        for cluster in self.clusters:
            if len(cluster.template_tokens) == msg_len:
                sim = self.get_similarity(tokens, cluster.template_tokens)
                if sim > best_sim:
                    best_sim = sim
                    best_cluster = cluster

        # Match threshold
        if best_cluster and best_sim >= self.similarity_threshold:
            # Update template with wildcard
            new_tokens = []
            extracted_params = []
            for t_old, t_new in zip(best_cluster.template_tokens, tokens):
                if t_old == t_new:
                    new_tokens.append(t_old)
                else:
                    new_tokens.append("<*>")
                    extracted_params.append(t_new)
            best_cluster.template_tokens = new_tokens
            target_cluster = best_cluster
            if extracted_params:
                target_cluster.sample_params.append(extracted_params)
        else:
            # Create new cluster
            target_cluster = DrainCluster(self._next_id, tokens)
            self._next_id += 1
            self.clusters.append(target_cluster)

        # Update stats
        target_cluster.size += 1
        if entry_dict.get("level") in ["ERROR", "CRITICAL"]:
            target_cluster.error_count += 1

        ts = entry_dict.get("timestamp")
        if ts:
            if not target_cluster.first_seen:
                target_cluster.first_seen = ts
            target_cluster.last_seen = ts

        if len(target_cluster.sample_logs) < 5:
            target_cluster.sample_logs.append(entry_dict)

        return target_cluster.cluster_id

    def get_clusters_summary(self) -> List[Dict[str, Any]]:
        # Sort by frequency descending
        sorted_clusters = sorted(self.clusters, key=lambda c: c.size, reverse=True)
        return [c.to_dict() for c in sorted_clusters]
