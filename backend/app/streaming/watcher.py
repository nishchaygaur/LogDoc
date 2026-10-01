import asyncio
import json
import os
import random
from typing import Set, Dict, Any, Optional
from datetime import datetime
from fastapi import WebSocket
from ..parsers.detector import detect_parser
from ..parsers.base import LogEntry
from ..store import GLOBAL_STORE

class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast(self, message: Dict[str, Any]):
        for connection in list(self.active_connections):
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                self.disconnect(connection)

WS_MANAGER = ConnectionManager()

class LiveSimulator:
    def __init__(self, dataset_name: str = "live_stream", delay_seconds: float = 1.0):
        self.dataset_name = dataset_name
        self.delay_seconds = delay_seconds
        self.is_running = False
        self.task: Optional[asyncio.Task] = None

    async def start(self):
        if self.is_running:
            return
        self.is_running = True
        self.task = asyncio.create_task(self._run())

    async def stop(self):
        self.is_running = False
        if self.task:
            self.task.cancel()
            self.task = None

    async def _run(self):
        dataset = GLOBAL_STORE.get_dataset(self.dataset_name)
        if not dataset:
            dataset = GLOBAL_STORE.create_dataset(self.dataset_name, parser_type="json")

        services = ["api-gateway", "auth-service", "cart-service", "payment-service", "order-service"]
        levels = ["INFO", "INFO", "INFO", "WARN", "DEBUG"]

        while self.is_running:
            try:
                await asyncio.sleep(self.delay_seconds)
                
                # Generate a realistic live event
                now_str = datetime.now().strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
                svc = random.choice(services)
                lvl = random.choice(levels)
                
                # 10% chance of error
                if random.random() < 0.10:
                    lvl = "ERROR"
                    msg = random.choice([
                        "Database connection pool exhausted: HikariPool-1 timeout after 30000ms",
                        "Upstream call to payment-service failed: HTTP 504 Gateway Timeout",
                        "JWT validation failed: signature has expired",
                        "Kafka producer buffer full: failed to deliver payload"
                    ])
                else:
                    msg = random.choice([
                        f"Handled HTTP request from client IP 192.168.1.{random.randint(10, 200)}",
                        f"Dispatched notification to queue events-worker-{random.randint(1, 4)}",
                        f"Database query cache hit: key=usr_session_{random.randint(100, 999)}",
                        f"Session authenticated successfully for token bearer-xyz",
                        f"Checked inventory for SKU_{random.randint(1000, 9999)}: stock=42"
                    ])

                raw_line = f'{{"timestamp":"{now_str}","level":"{lvl}","service":"{svc}","message":"{msg}"}}'
                
                from ..parsers.json_parser import JsonParser
                parser = JsonParser()
                entry = parser.parse_line(raw_line, line_no=len(dataset.entries) + 1, source="live_simulator")
                
                if entry:
                    dataset.add_entries([entry])
                    # Broadcast to active WebSockets
                    await WS_MANAGER.broadcast({
                        "type": "log_entry",
                        "dataset": self.dataset_name,
                        "entry": entry.to_dict()
                    })

            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error in LiveSimulator: {e}")
                await asyncio.sleep(2)

SIMULATOR = LiveSimulator()
