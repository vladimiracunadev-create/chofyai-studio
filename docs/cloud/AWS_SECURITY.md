# 🔒 Seguridad y Cumplimiento en AWS

> **Modelo de seguridad por capas, controles obligatorios y prácticas de hardening para ChofyAI Studio en AWS.**

[![AWS](https://img.shields.io/badge/Cloud-AWS-FF9900?logo=amazonaws&logoColor=white)](https://aws.amazon.com)
[![CIS](https://img.shields.io/badge/Baseline-CIS%20AWS%20Foundations-blue)](https://www.cisecurity.org/benchmark/amazon_web_services)
[![Encryption](https://img.shields.io/badge/Cifrado-At--rest%20%2B%20In--transit-2d7a66)](#-3-cifrado)

---

## 🛡️ 1. Modelo de responsabilidad compartida

```mermaid
flowchart TB
    subgraph AWS["☁️ Responsabilidad de AWS"]
        H["🏢 Hardware, red física, hipervisor"]
        S["📦 Servicios gestionados (RDS, S3, etc.)"]
    end
    subgraph YOU["👤 Tu responsabilidad"]
        D["📊 Datos y clasificación"]
        I["🔐 IAM y acceso"]
        N["🌐 Configuración red (SG, NACL)"]
        A["📱 Apps y código"]
        E["🔑 Cifrado del lado cliente"]
    end

    style AWS fill:#fff3e0,stroke:#e65100
    style YOU fill:#ffebee,stroke:#b71c1c
```

> AWS protege la nube. **Tú proteges lo que pones en ella.**

---

## 🧩 2. Defensa en profundidad

```mermaid
flowchart LR
    L1["🌍 Edge<br/>WAF + CloudFront"] --> L2["🔐 Identidad<br/>Cognito + IAM"]
    L2 --> L3["🌐 Red<br/>VPC + SG + NACL"]
    L3 --> L4["📦 App<br/>Container hardening"]
    L4 --> L5["💾 Datos<br/>KMS + Secrets"]
    L5 --> L6["📊 Detección<br/>GuardDuty + CT"]

    style L1 fill:#fff3e0,stroke:#e65100
    style L2 fill:#fff8e1,stroke:#f57f17
    style L3 fill:#e8f5e9,stroke:#1b5e20
    style L4 fill:#e3f2fd,stroke:#0d47a1
    style L5 fill:#f3e5f5,stroke:#4a148c
    style L6 fill:#ffebee,stroke:#b71c1c
```

---

## 🔑 3. Cifrado

| Recurso | En reposo | En tránsito |
|:---|:---|:---|
| RDS | KMS CMK (`aws/rds` o propia) | TLS obligatorio (`rds.force_ssl=1`) |
| S3 | SSE-KMS por bucket | HTTPS only via bucket policy |
| EFS | KMS al crear | TLS via mount helper |
| EBS (workers GPU) | KMS por defecto | n/a |
| Secrets Manager | KMS gestionado | TLS |
| CloudFront ↔ origen | — | TLS 1.2+ con SNI |
| ALB ↔ ECS | — | mTLS opcional con ACM Private CA |

> [!IMPORTANT]
> **Una CMK por entorno** (`dev`, `staging`, `prod`). Rotación anual automática activada.

---

## 👤 4. IAM — principio de menor privilegio

### 4.1 Roles principales

| Rol | Para | Permisos clave |
|:---|:---|:---|
| `chofy-fargate-task-role` | Backend Rust | `sqs:SendMessage`, `s3:PutObject` (prefijo `jobs/*`), `secretsmanager:GetSecretValue` |
| `chofy-worker-role` | EC2 GPU | `sqs:ReceiveMessage/DeleteMessage`, `s3:Get/Put`, `efs-client:*` |
| `chofy-deployer` | CI/CD (OIDC desde GitHub) | `ecr:Push`, `ecs:UpdateService`, scoped a recursos del proyecto |
| `chofy-readonly-ops` | Humanos on-call | `cloudwatch:*Read*`, `logs:Get*`, sin permisos de escritura |

### 4.2 Buenas prácticas

- ✅ **Sin claves estáticas** en CI: GitHub Actions ↔ AWS por **OIDC**.
- ✅ **MFA obligatorio** para todos los usuarios humanos.
- ✅ **Service Control Policies (SCP)** a nivel Organization (bloqueo de regiones, deny de `iam:DeleteRole` sin MFA).
- ✅ **Permission Boundaries** para roles creados por developers.
- ✅ Revisión trimestral con **IAM Access Analyzer**.

---

## 🌐 5. Red

| Control | Configuración |
|:---|:---|
| **VPC privada** | Workloads en subnets privadas, sólo ALB en públicas |
| **Security Groups** | Default deny, abrir solo puerto 443 desde ALB → ECS, 5432 desde ECS → RDS |
| **NACLs** | Stateless extra layer; deny RFC1918 cross-VPC |
| **VPC Flow Logs** | A CloudWatch + S3, 30 días de retención |
| **PrivateLink / VPC Endpoints** | S3, ECR, Secrets, KMS, CloudWatch — evita salir a Internet |
| **Egress controlado** | NAT solo desde subnets privadas; opcional `aws-network-firewall` |

---

## 🔍 6. Secretos

| Tipo | Servicio | Rotación |
|:---|:---|:---|
| Password DB | Secrets Manager | 30 días automática |
| JWT signing key | Secrets Manager | 90 días manual |
| OAuth client secrets | Secrets Manager | según provider |
| API keys de terceros | Secrets Manager | por proveedor |
| Config no sensible | Parameter Store (`String`) | n/a |

> **Nunca** en variables de entorno hardcoded. **Nunca** en repos. Pre-commit hooks con `detect-secrets` + GitHub Advanced Security activado.

---

## 🛡️ 7. Capa aplicación

| Práctica | Detalle |
|:---|:---|
| **Imagen distroless** | Backend Rust en `gcr.io/distroless/cc` o `scratch` |
| **Read-only rootfs** | `readonlyRootFilesystem: true` en task definition |
| **Non-root user** | `USER 65532` en Dockerfile |
| **Scan en ECR** | Activar enhanced scanning (Inspector) |
| **SBOM** | Generado por build, almacenado en S3 versionado |
| **Dependency pinning** | `Cargo.lock` y `package-lock.json` commiteados |
| **Cabeceras** | CSP estricta, `X-Content-Type-Options: nosniff`, HSTS preload |

---

## 🚨 8. Detección y respuesta

```mermaid
flowchart LR
    GD["🛡️ GuardDuty"] --> SH["🏛️ Security Hub"]
    Inspector["🔬 Inspector"] --> SH
    Macie["🕵️ Macie (S3 PII)"] --> SH
    Config["📋 AWS Config<br/>(reglas CIS)"] --> SH
    SH --> SNS["📣 SNS topic<br/>security-critical"]
    SNS --> Slack["💬 Slack #sec"]
    SNS --> PD["📟 PagerDuty"]

    style GD fill:#ffebee,stroke:#b71c1c
    style SH fill:#fce4ec,stroke:#880e4f
    style PD fill:#fff8e1,stroke:#f57f17
```

| Servicio | Qué detecta |
|:---|:---|
| **GuardDuty** | Tráfico C2, escaneos, credentials exfil |
| **Inspector** | CVEs en imágenes ECR y AMIs EC2 |
| **Macie** | PII expuesta en S3 |
| **Config** | Drift contra reglas CIS/PCI |
| **CloudTrail** | Auditoría de toda llamada AWS |

---

## 📋 9. Cumplimiento y baseline

| Estándar | Aplicabilidad | Servicios habilitadores |
|:---|:---|:---|
| **CIS AWS Foundations 1.5** | Mínimo recomendado | Config + Security Hub |
| **GDPR** | Si usuarios en UE | Cifrado + DPA AWS + región EU |
| **SOC 2 Type II** | Si vendes a empresas | Audit trail + IaC versionado |
| **PCI DSS** | Si tocas tarjetas | NO tocar tarjetas — usar Stripe |

> [!TIP]
> Para no entrar en alcance PCI, **delega cobros 100 % a Stripe Checkout/Elements** y nunca persistas PAN.

---

## ✅ 10. Checklist de hardening día 1

- [ ] Root account con MFA hardware y guardada en caja fuerte
- [ ] Organización AWS + cuentas separadas `dev`/`prod`
- [ ] CloudTrail multi-región a S3 versionado con MFA delete
- [ ] GuardDuty + Security Hub activos en todas las regiones
- [ ] Config rules CIS habilitadas
- [ ] IAM Identity Center (SSO) — sin usuarios IAM personales
- [ ] OIDC desde GitHub Actions (sin access keys en CI)
- [ ] Budgets con alarmas SNS a 50/80/100 %
- [ ] Backup plan AWS Backup para RDS y EFS
- [ ] Runbook de respuesta a incidente probado

---

## 🔗 Más

- [AWS Security Reference Architecture](https://docs.aws.amazon.com/prescriptive-guidance/latest/security-reference-architecture/welcome.html)
- [`AWS_MIGRATION.md`](AWS_MIGRATION.md) — visión general
- [`AWS_STEP_BY_STEP.md`](AWS_STEP_BY_STEP.md) — implementar controles
