# Stage 1: Build static Rust binary with dependency layer caching
FROM rust:alpine AS builder
WORKDIR /build

RUN apk add --no-cache build-base musl-dev

# Cache Cargo dependencies before copying application code
COPY Cargo.toml Cargo.lock* ./
RUN mkdir -p src && echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src target/release/deps/audit_service* target/release/audit-service*

COPY src ./src
RUN touch src/main.rs && cargo build --release

# Stage 2: Minimal Alpine runtime (~15MB total) with non-root user
FROM alpine:3.20 AS runner
WORKDIR /app

RUN apk add --no-cache libgcc && \
    addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup && \
    mkdir -p /data && \
    chown -R 10001:10001 /app /data

COPY --from=builder /build/target/release/audit-service /app/audit-service
RUN chown 10001:10001 /app/audit-service

USER 10001:10001
ENV PORT=8082 \
    AUDIT_LOG_PATH=/data/audit.jsonl

EXPOSE 8082

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8082/health || exit 1

ENTRYPOINT ["/app/audit-service"]

