# 🏗️ Arquitectura Objetivo en AWS

> **Diseño detallado del sistema multi-tenant en AWS, capa por capa.**

[![AWS](https://img.shields.io/badge/Cloud-AWS-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![Pattern](https://img.shields.io/badge/Patrón-Event--driven-2d7a66)](https://aws.amazon.com/event-driven-architecture/)
[![SLA](https://img.shields.io/badge/SLA%20objetivo-99.5%25-blue)](AWS_MIGRATION.md)

---

## 🧭 1. Vista panorámica

```mermaid
flowchart TB
    subgraph Internet["🌐 Internet"]
        U["👤 Browser"]
        T["🖥️ Tauri Desktop<br/>(modo cloud)"]
    end

    subgraph AWS["☁️ AWS us-east-1"]
        subgraph Public["🌍 Subnets públicas"]
            ALB["⚖️ Application<br/>Load Balancer"]
            NAT["🔁 NAT Gateway"]
        end

        subgraph PrivApp["🔒 Subnets privadas — APP"]
            ECS["🦀 ECS Fargate<br/>Backend Rust"]
            REDIS["🟥 ElastiCache Redis<br/>(sesiones / rate-limit)"]
        end

        subgraph PrivData["🔒 Subnets privadas — DATA"]
            RDS["🗄️ RDS PostgreSQL<br/>Multi-AZ"]
            EFS["📁 EFS<br/>(modelos)"]
        end

        subgraph PrivGpu["🔒 Subnets privadas — GPU"]
            ASG["📈 ASG GPU<br/>g6.xlarge spot+on-demand"]
            W1["🛠️ Worker ComfyUI"]
            W2["🛠️ Worker TTS"]
            W3["🛠️ Worker FaceFusion"]
            W4["🛠️ Worker AceForge"]
            W5["🛠️ Worker Whisper (CPU)"]
        end

        subgraph Edge["🌍 Edge"]
            CF["🌐 CloudFront"]
            S3W["🪣 S3 (UI build)"]
            APIGW["🚪 API Gateway"]
            COG["👤 Cognito"]
            WAF["🛡️ WAF"]
        end

        subgraph Async["📨 Asíncrono"]
            SQS["📬 SQS jobs"]
            DLQ["☠️ SQS DLQ"]
            EB["🚌 EventBridge"]
        end

        subgraph Storage["💾 Storage"]
            S3A["🪣 S3 artefactos"]
            ECR["🐳 ECR (imágenes)"]
            SM["🔑 Secrets Manager"]
            PS["📜 Parameter Store"]
        end

        subgraph Obs["📊 Observabilidad"]
            CW["📈 CloudWatch"]
            XR["🔬 X-Ray"]
            CT["📜 CloudTrail"]
        end
    end

    U --> CF
    T --> CF
    CF --> WAF --> S3W
    CF --> APIGW --> COG
    APIGW --> ALB --> ECS
    ECS --> RDS
    ECS --> REDIS
    ECS --> SQS
    ECS --> SM
    SQS --> ASG
    ASG --> W1 & W2 & W3 & W4 & W5
    W1 & W2 & W3 & W4 & W5 --> EFS
    W1 & W2 & W3 & W4 & W5 --> S3A
    SQS -->|fallos| DLQ --> EB
    ECS & ASG --> CW
    ECS --> XR

    style CF fill:#fff3e0,stroke:#e65100
    style ECS fill:#fce4ec,stroke:#880e4f
    style ASG fill:#e8f5e9,stroke:#1b5e20
    style RDS fill:#e3f2fd,stroke:#0d47a1
    style EFS fill:#f3e5f5,stroke:#4a148c
    style COG fill:#fff8e1,stroke:#f57f17
```

---

## 🌐 2. Capa de red (VPC)

| Recurso | Detalle |
|:---|:---|
| **VPC** | `10.0.0.0/16` |
| **AZs** | 3 zonas (`us-east-1a/b/c`) |
| **Subnets públicas** | `10.0.0.0/24`, `10.0.1.0/24`, `10.0.2.0/24` |
| **Subnets privadas APP** | `10.0.10.0/24`, `10.0.11.0/24`, `10.0.12.0/24` |
| **Subnets privadas DATA** | `10.0.20.0/24`, `10.0.21.0/24`, `10.0.22.0/24` |
| **Subnets privadas GPU** | `10.0.30.0/24`, `10.0.31.0/24`, `10.0.32.0/24` |
| **NAT Gateway** | 1 por AZ (HA) o 1 único en dev |
| **VPC Endpoints** | S3 (Gateway) + ECR + Secrets Manager + CloudWatch (Interface) |

> [!TIP]
> Los **VPC endpoints** evitan cobros de NAT para tráfico hacia S3/ECR. En cargas con modelos grandes, ahorran ~30 % en transferencia.

---

## 🌍 3. Capa edge

```mermaid
flowchart LR
    User["👤 Usuario"] --> R53["🧭 Route 53<br/>chofyai.app"]
    R53 --> CF["🌐 CloudFront"]
    CF --> WAF["🛡️ WAF<br/>OWASP rules + rate-limit"]
    WAF --> Origin1["🪣 S3 origin<br/>(/, /assets/*)"]
    WAF --> Origin2["🚪 API Gateway origin<br/>(/api/*, /ws/*)"]

    style CF fill:#fff3e0,stroke:#e65100
    style WAF fill:#ffebee,stroke:#b71c1c
```

| Componente | Configuración clave |
|:---|:---|
| **Route 53** | Hosted zone para dominio propio + alias a CloudFront |
| **CloudFront** | OAC para S3, cache TTL 1 año en `/assets/*`, 0 s en `/api/*` |
| **WAF** | Reglas managed: Core, Known Bad Inputs, IP reputation, Rate-limit 1000 req/5min |
| **ACM** | Certificado SSL gratuito en `us-east-1` (requisito de CloudFront) |

---

## 🔐 4. Capa de identidad

```mermaid
sequenceDiagram
    actor U as Usuario
    participant UI as React UI
    participant Cog as Cognito
    participant API as API Gateway
    participant BE as Backend ECS

    U->>UI: login (email + pass)
    UI->>Cog: InitiateAuth (SRP)
    Cog-->>UI: ID + Access + Refresh tokens
    UI->>API: GET /api/jobs (Authorization: Bearer ...)
    API->>API: Cognito Authorizer valida JWT
    API->>BE: forward + claims en headers
    BE-->>API: 200 OK
    API-->>UI: respuesta
```

| Aspecto | Implementación |
|:---|:---|
| **User Pool** | Cognito con MFA opcional (TOTP) |
| **Grupos** | `admin`, `creator`, `viewer` |
| **Federación** | Google + GitHub OAuth (opcional) |
| **Tokens** | JWT de 1 h, refresh 30 días |

---

## 🦀 5. Capa de aplicación (backend)

### 5.1 Servicio ECS Fargate

| Setting | Valor |
|:---|:---|
| **Imagen** | Multi-stage Rust 1.94 → distroless (~25 MB) |
| **CPU/RAM** | 0.5 vCPU / 1 GB (mínimo); autoscale a 4 vCPU / 8 GB |
| **Réplicas** | min 2 (HA), max 10 |
| **Health check** | `GET /healthz` cada 15 s |
| **Deploy** | Rolling 50 % min healthy, circuit breaker activado |

### 5.2 API expuesta

| Endpoint | Método | Descripción |
|:---|:---:|:---|
| `/api/tools` | `GET` | Listar herramientas y estados |
| `/api/jobs` | `POST` | Encolar job (`{ tool, params }`) |
| `/api/jobs/:id` | `GET` | Estado y resultado |
| `/api/jobs/:id/logs` | `GET` | Stream logs CloudWatch |
| `/ws/jobs/:id` | `WS` | Push de progreso en tiempo real |
| `/api/storage/upload` | `POST` | Presigned URL S3 |

---

## 🧠 6. Capa de inferencia (workers GPU)

### 6.1 Patrón de despacho

```mermaid
flowchart LR
    BE["🦀 Backend"] --> SQS["📬 SQS<br/>jobs.fifo"]
    SQS --> ASG["📈 ASG GPU"]
    ASG -->|scale-out<br/>SQS depth > N| W["🛠️ Worker EC2"]
    W -->|long-poll| SQS
    W -->|update| RDS["🗄️ RDS"]
    W -->|artefactos| S3["🪣 S3"]
    W -->|done event| EB["🚌 EventBridge"]
    EB --> WS["🔔 WebSocket push"]

    style SQS fill:#fff8e1,stroke:#f57f17
    style ASG fill:#e8f5e9,stroke:#1b5e20
    style EB fill:#f3e5f5,stroke:#4a148c
```

### 6.2 Estrategia de instancias

| Tipo | Uso | Costo relativo |
|:---|:---|:---:|
| `g6.xlarge` On-Demand | Sesiones interactivas, prioridad alta | 1.0× |
| `g6.xlarge` Spot | Batch tolerante a interrupción | 0.35× |
| `g6.2xlarge` On-Demand | Modelos > 16 GB VRAM | 1.8× |
| `c7i.2xlarge` | Whisper.cpp (CPU) | 0.15× |

### 6.3 Ciclo de vida de un worker

```mermaid
stateDiagram-v2
    [*] --> Booting: ASG launch
    Booting --> Warming: cloud-init descarga modelo desde EFS
    Warming --> Idle: health OK
    Idle --> Running: SQS pull
    Running --> Idle: job done
    Idle --> Draining: scale-in / spot-interrupt
    Draining --> [*]
```

---

## 💾 7. Capa de datos

| Servicio | Uso | Configuración |
|:---|:---|:---|
| **RDS PostgreSQL 16** | Estado: usuarios, jobs, settings, audit | `db.t4g.small` Multi-AZ, 20 GB gp3, snapshots 7 días |
| **ElastiCache Redis 7** | Sesiones, rate-limit, locks | `cache.t4g.micro`, sin réplica en dev |
| **EFS** | Modelos compartidos read-mostly (10–200 GB) | Elastic Throughput, lifecycle IA a 30 días |
| **S3 — UI** | Build estático del frontend | versionado, OAC, cache headers |
| **S3 — artefactos** | Inputs/outputs de jobs | lifecycle: Standard → IA (30d) → Glacier (180d) |
| **DynamoDB** *(opcional)* | Tabla `sessions_ws` con TTL | on-demand |
| **Secrets Manager** | DB pass, JWT signing, OAuth | rotación cada 90 días |
| **Parameter Store** | Config no sensible | tipo `String`/`StringList` |

---

## 📊 8. Disponibilidad y resiliencia

| Componente | Estrategia |
|:---|:---|
| ALB / API Gateway | Multi-AZ por defecto |
| ECS Fargate | min 2 réplicas en 2 AZ |
| RDS | Multi-AZ (failover ~60 s) |
| EFS | Regional (3 AZ) |
| Workers GPU | ASG cross-AZ + Spot diversificado |
| Backups | RDS snapshots + S3 versioning + AMI workers |
| DR | Snapshot cross-region semanal a `us-west-2` |

> SLA objetivo: **99.5 %** mensual (~3.6 h de caída/mes). Para 99.9 % se necesitan workers warm-pool y Aurora multi-region.

---

## 🔬 9. Observabilidad

```mermaid
flowchart LR
    App["🦀 Backend / 🛠️ Workers"] -->|logs| CWL["📜 CloudWatch Logs"]
    App -->|metrics| CWM["📈 CloudWatch Metrics"]
    App -->|traces| XR["🔬 X-Ray"]
    CWM --> Alarms["🚨 Alarmas"] --> SNS["📣 SNS"] --> Email["📧 Email/Slack"]
    CWL --> Insights["🔎 CW Logs Insights"]
    AWS["☁️ AWS APIs"] --> CT["📜 CloudTrail"] --> S3CT["🪣 S3 audit"]

    style Alarms fill:#ffebee,stroke:#b71c1c
    style XR fill:#fce4ec,stroke:#880e4f
```

| KPI | Umbral | Acción |
|:---|:---:|:---|
| `5xx_rate` backend | > 1 % en 5 min | PagerDuty + autoscale |
| `sqs_oldest_message_age` | > 300 s | scale-out workers |
| `gpu_utilization` | < 10 % por 15 min | scale-in |
| `rds_cpu` | > 80 % por 10 min | aviso, considerar upsize |
| `cost_anomaly` | desviación > 30 % | aviso a finanzas |

---

## 🔗 10. Siguientes lecturas

- [`AWS_SERVICES.md`](AWS_SERVICES.md) — qué hace cada servicio AWS aquí dibujado
- [`AWS_COSTS.md`](AWS_COSTS.md) — cuánto cuesta esta arquitectura
- [`AWS_STEP_BY_STEP.md`](AWS_STEP_BY_STEP.md) — desplegarla con Terraform
