import random
from datetime import datetime, timedelta
from typing import List

def generate_microservices_logs(count: int = 400) -> str:
    services = ["api-gateway", "auth-service", "cart-service", "order-service", "payment-service", "inventory-service"]
    levels = ["INFO", "DEBUG"]
    lines = []
    
    start_time = datetime.now() - timedelta(minutes=15)
    
    # 70% normal traffic, 20% degradation, 10% recovery
    outage_start = int(count * 0.5)
    outage_end = int(count * 0.85)

    for i in range(count):
        curr_time = start_time + timedelta(seconds=i * 2 + random.uniform(0, 1))
        ts_str = curr_time.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
        trace_id = f"tr-{random.randint(10000, 99999)}"

        if outage_start <= i <= outage_end:
            # Outage phase
            prob = random.random()
            if prob < 0.4:
                # Payment failure
                lines.append(
                    f'{{"timestamp":"{ts_str}","level":"ERROR","service":"payment-service","trace_id":"{trace_id}",'
                    f'"message":"HikariPool-1 - Connection is not available, request timed out after 30000ms.",'
                    f'"exception":"java.sql.SQLTransientConnectionException: HikariPool-1 - Connection is not available"}}'
                )
            elif prob < 0.7:
                # Order service timeout
                lines.append(
                    f'{{"timestamp":"{ts_str}","level":"ERROR","service":"order-service","trace_id":"{trace_id}",'
                    f'"message":"Call to http://payment-service:8080/v1/charge failed: 504 Gateway Timeout",'
                    f'"circuit_breaker":"OPEN"}}'
                )
            elif prob < 0.85:
                # API Gateway 502/504
                sc = random.choice([502, 504])
                lines.append(
                    f'{{"timestamp":"{ts_str}","level":"WARN","service":"api-gateway","trace_id":"{trace_id}",'
                    f'"status_code":{sc},"message":"POST /api/v1/checkout upstream error HTTP {sc}"}}'
                )
            else:
                # Normal background log
                svc = random.choice(["auth-service", "inventory-service"])
                lines.append(
                    f'{{"timestamp":"{ts_str}","level":"INFO","service":"{svc}","trace_id":"{trace_id}",'
                    f'"message":"Processed read event successfully"}}'
                )
        else:
            # Normal traffic
            svc = random.choice(services)
            lvl = "DEBUG" if random.random() < 0.2 else "INFO"
            actions = [
                f"Token verified for user usr_{random.randint(100, 999)}",
                f"Cart items calculated total: ${random.randint(10, 500)}.00",
                f"Inventory reserved item_{random.randint(1000, 9999)} quantity={random.randint(1, 5)}",
                f"Payment intent created for amount ${random.randint(10, 500)}.00",
                f"HTTP GET /api/v1/catalog returned 200 OK duration={random.randint(15, 80)}ms",
            ]
            msg = random.choice(actions)
            lines.append(
                f'{{"timestamp":"{ts_str}","level":"{lvl}","service":"{svc}","trace_id":"{trace_id}","message":"{msg}"}}'
            )

    return "\n".join(lines)


def generate_nginx_logs(count: int = 350) -> str:
    ips = [f"192.168.1.{random.randint(2, 250)}" for _ in range(15)] + ["10.0.4.15", "172.16.0.8"]
    methods = ["GET", "POST", "PUT", "DELETE"]
    endpoints = [
        ("/index.html", 200),
        ("/api/v1/products", 200),
        ("/api/v1/users/profile", 200),
        ("/api/v1/checkout", 200),
        ("/static/bundle.js", 304),
        ("/static/styles.css", 200),
        ("/admin/config.php", 404),
        ("/api/v1/orders", 201),
        ("/api/v1/search?q=laptop", 200),
    ]
    user_agents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "curl/7.88.1",
        "Googlebot/2.1 (+http://www.google.com/bot.html)",
    ]

    start_time = datetime.now() - timedelta(minutes=20)
    lines = []

    for i in range(count):
        curr_time = start_time + timedelta(seconds=i * 3 + random.uniform(0, 2))
        ts_str = curr_time.strftime("%d/%b/%Y:%H:%M:%S +0000")
        ip = random.choice(ips)
        method = random.choice(methods) if random.random() < 0.25 else "GET"
        endpoint, status = random.choice(endpoints)
        
        # Inject occasional errors
        if 200 <= i <= 240:
            if random.random() < 0.6:
                status = 502
                endpoint = "/api/v1/checkout"
        elif random.random() < 0.05:
            status = random.choice([401, 403, 404, 500])

        bytes_sent = random.randint(250, 48000) if status < 400 else random.randint(120, 500)
        referrer = "https://example.com" if random.random() > 0.3 else "-"
        ua = random.choice(user_agents)

        line = f'{ip} - - [{ts_str}] "{method} {endpoint} HTTP/1.1" {status} {bytes_sent} "{referrer}" "{ua}"'
        lines.append(line)

    return "\n".join(lines)


def generate_auth_attack_logs(count: int = 250) -> str:
    lines = []
    start_time = datetime.now() - timedelta(minutes=10)
    attacker_ip = "203.0.113.42"
    internal_ip = "192.168.1.10"
    
    users = ["admin", "root", "oracle", "test", "postgres", "ubuntu", "git"]

    for i in range(count):
        curr_time = start_time + timedelta(seconds=i * 2 + random.uniform(0, 1))
        ts_str = curr_time.strftime("%b %d %H:%M:%S")

        if 40 <= i <= 180:
            # Brute force attack in progress
            target_user = random.choice(users)
            port = random.randint(40000, 65000)
            line = f"{ts_str} srv-edge-01 sshd[{random.randint(1000, 9999)}]: Failed password for {target_user} from {attacker_ip} port {port} ssh2"
        else:
            # Normal syslog
            if random.random() < 0.3:
                line = f"{ts_str} srv-edge-01 sshd[{random.randint(1000, 9999)}]: Accepted publickey for devops from {internal_ip} port 52140 ssh2"
            elif random.random() < 0.6:
                line = f"{ts_str} srv-edge-01 systemd[1]: Starting Daily apt download activities..."
            else:
                line = f"{ts_str} srv-edge-01 cron[{random.randint(1000, 9999)}]: (root) CMD (/usr/local/bin/backup-sync.sh > /dev/null)"
        lines.append(line)

    return "\n".join(lines)


def generate_springboot_stacktraces(count: int = 180) -> str:
    lines = []
    start_time = datetime.now() - timedelta(minutes=8)
    
    for i in range(count):
        curr_time = start_time + timedelta(seconds=i * 2.5 + random.uniform(0, 1))
        ts_str = curr_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

        if 50 <= i <= 65:
            # Java NullPointerException stacktrace
            pid = 28412
            header = f"{ts_str} ERROR {pid} --- [nio-8080-exec-4] c.e.orders.OrderProcessingService      : Exception occurred during order fulfillment"
            trace = """java.lang.NullPointerException: Cannot invoke "com.example.orders.UserAccount.getBalance()" because "user" is null
\tat com.example.orders.OrderProcessingService.validateCredit(OrderProcessingService.java:142)
\tat com.example.orders.OrderProcessingService.processOrder(OrderProcessingService.java:87)
\tat com.example.orders.OrderController.submit(OrderController.java:54)
\tat jdk.internal.reflect.NativeMethodAccessorImpl.invoke0(Native Method)
\tat org.springframework.web.method.support.InvocableHandlerMethod.doInvoke(InvocableHandlerMethod.java:205)
\tat org.springframework.web.servlet.DispatcherServlet.doDispatch(DispatcherServlet.java:1081)"""
            lines.append(header + "\n" + trace)
        else:
            lvl = "INFO"
            msgs = [
                "Initializing Spring Framework Servlet 'dispatcherServlet'",
                "Completed 200 OK in 14ms",
                "Fetching user preferences for account #94821",
                "Kafka consumer partition rebalance completed successfully",
                "Scheduled audit cron job finished in 420ms"
            ]
            lines.append(f"{ts_str}  {lvl} 28412 --- [nio-8080-exec-{random.randint(1, 10)}] c.e.orders.OrderProcessingService      : {random.choice(msgs)}")

    return "\n".join(lines)
