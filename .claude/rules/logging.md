# Rule: Logging Standards

These rules apply to all stacks. Stack-specific sections below cover Kotlin/JVM and TypeScript/Node.js implementation.

## Mandatory Structured Fields

Every log entry in production must include:

| Field | Value | Source |
|---|---|---|
| `timestamp` | ISO 8601 UTC | Logger |
| `level` | trace/debug/info/warn/error | Logger |
| `service` | Service name | Env var / config |
| `traceId` | Request correlation ID | MDC / AsyncLocalStorage |
| `spanId` | Current span (if tracing) | MDC / OpenTelemetry |
| `message` | Human-readable event description | Code |
| `env` | production / staging / local | Env var |

Add contextual fields per event (e.g., `userId`, `orderId`, `durationMs`).

## Log Level Policy

| Level | When | Examples |
|---|---|---|
| `ERROR` | System cannot proceed; requires attention | DB connection failed, unhandled exception |
| `WARN` | Unexpected but recoverable; may indicate a problem | Retry triggered, deprecated API used, slow query |
| `INFO` | Normal significant events | User created, order placed, service started |
| `DEBUG` | Developer troubleshooting | Method entry/exit, intermediate values |
| `TRACE` | Very verbose; disabled in production | Every DB row processed, every HTTP header |

**Production default**: INFO.
**Local development**: DEBUG.
**Never enable TRACE in production** unless diagnosing a specific incident (enable temporarily with runtime config change, not a deploy).

## What to Log

### Always

- Service start / stop
- External dependency failures (DB down, HTTP 5xx from downstream)
- Auth events: login success, login failure, token refresh
- Business events that matter to the business: order placed, payment processed, user registered
- Start and end of long-running background jobs

### Never

- Passwords, secrets, tokens, API keys
- Full PII (name, email, phone, SSN, card number) — log IDs instead
- Full request/response bodies (except gated behind DEBUG + PII scrubbing)
- Binary data or base64-encoded blobs

## Correlation

Inject a `traceId` on every inbound request (read from `X-Trace-Id` header or generate). Propagate it:
- In HTTP calls to downstream services (`X-Trace-Id` header)
- In message headers to queues/topics
- In DB queries (via application-level metadata where supported)

Log the `traceId` on every log entry so a full request trace can be reconstructed from logs.

## Error Logging

When logging an error, always include the exception/stack trace:

```kotlin
logger.error(ex) { "Payment processing failed orderId=${order.id}" }
```

```typescript
logger.error({ err, orderId: order.id }, 'Payment processing failed');
```

```csharp
_logger.LogError(ex, "Payment processing failed {OrderId}", order.Id);
```

Log the exception **once** at the point where you have full context — do not re-log as it bubbles up.

## Performance Logging

For operations > 500ms:

```kotlin
val start = System.currentTimeMillis()
val result = expensiveOperation()
val durationMs = System.currentTimeMillis() - start
if (durationMs > 500) logger.warn { "Slow operation durationMs=$durationMs operationName=expensiveOperation" }
```

Add `durationMs` to all external calls (DB queries, HTTP calls, message sends).

## Log Aggregation

All services write JSON to stdout. Log aggregation is handled by the infrastructure layer (Loki, Elasticsearch, Datadog, CloudWatch). Agents do not configure log shipping — that is infrastructure.

## Sensitive Field Masking

Models that may appear in logs must mask sensitive fields in `toString()`:

```kotlin
data class PaymentRequest(val amount: BigDecimal, val cardNumber: String) {
    override fun toString() = "PaymentRequest(amount=$amount, cardNumber=****${cardNumber.takeLast(4)})"
}
```

Mark sensitive fields with `@JsonProperty(access = READ_ONLY)` or custom serialiser to prevent accidental serialisation.

## Kotlin/JVM Implementation

### Dependencies

```kotlin
// build.gradle.kts
implementation("io.github.oshai:kotlin-logging-jvm:7.0.0")
implementation("net.logstash.logback:logstash-logback-encoder:8.0")
```

### Logger declaration

```kotlin
private val logger = KotlinLogging.logger {}
```

Never use `LoggerFactory.getLogger(...)` directly — always use `KotlinLogging.logger {}`.

### Structured key=value format

```kotlin
// WRONG - unstructured string interpolation
logger.info { "User ${user.id} logged in" }

// RIGHT - structured key=value pairs
logger.info { "user_login userId=${user.id.value} ip=$ip" }

// ERROR - always attach the exception
logger.error(ex) { "payment_failed orderId=${order.id}" }
```

### MDC correlation filter

```kotlin
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
class MdcRequestFilter : OncePerRequestFilter() {
    override fun doFilterInternal(req: HttpServletRequest, res: HttpServletResponse, chain: FilterChain) {
        val traceId = req.getHeader("X-Trace-Id") ?: UUID.randomUUID().toString()
        MDC.put("traceId", traceId)
        res.addHeader("X-Trace-Id", traceId)
        try { chain.doFilter(req, res) } finally { MDC.clear() }
    }
}
```

### Logback JSON config (production)

```xml
<!-- logback-spring.xml -->
<configuration>
  <springProfile name="!local">
    <appender name="JSON" class="ch.qos.logback.core.ConsoleAppender">
      <encoder class="net.logstash.logback.encoder.LogstashEncoder">
        <includeMdcKeyName>traceId</includeMdcKeyName>
        <includeMdcKeyName>userId</includeMdcKeyName>
      </encoder>
    </appender>
    <root level="INFO"><appender-ref ref="JSON"/></root>
  </springProfile>
  <springProfile name="local">
    <appender name="CONSOLE" class="ch.qos.logback.core.ConsoleAppender">
      <encoder><pattern>%d{HH:mm:ss} %-5level %logger{36} - %msg%n</pattern></encoder>
    </appender>
    <root level="DEBUG"><appender-ref ref="CONSOLE"/></root>
  </springProfile>
</configuration>
```

### Service logging pattern

```kotlin
fun createUser(cmd: CreateUserCommand): User {
    logger.info { "createUser_start email=${cmd.email}" }
    return try {
        repo.save(User.create(cmd)).also { logger.info { "createUser_success userId=${it.id}" } }
    } catch (e: UserAlreadyExistsException) {
        logger.warn { "createUser_conflict email=${cmd.email}" }; throw e
    } catch (e: Exception) {
        logger.error(e) { "createUser_error email=${cmd.email}" }; throw e
    }
}
