# Stage 1: Build static Go binary with cached module layer
FROM golang:1.22-alpine AS builder
WORKDIR /build

COPY go.mod go.sum* ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o notification-service .

# Stage 2: Minimal Alpine runtime (~15MB total) with non-root user
FROM alpine:3.20 AS runner
WORKDIR /app

RUN apk --no-cache add ca-certificates && \
    addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

COPY --from=builder /build/notification-service /app/notification-service
RUN chown -R 10001:10001 /app

USER 10001:10001
ENV PORT=8081

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:8081/health || exit 1

ENTRYPOINT ["/app/notification-service"]

