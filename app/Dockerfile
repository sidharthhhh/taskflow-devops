# ==========================================
# Stage 1: Build the Spring Boot JAR
# ==========================================
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Copy Maven POM and pre-fetch dependencies for layer caching
COPY pom.xml .
RUN mvn dependency:resolve -B

# Copy source code and package executable JAR (skip tests during container build)
COPY src ./src
RUN mvn clean package -DskipTests

# ==========================================
# Stage 2: Lightweight Runtime Environment
# ==========================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create unprivileged system user with specific numeric UID/GID for Kubernetes compatibility
RUN addgroup -g 10001 -S appgroup && adduser -u 10001 -S appuser -G appgroup

# Copy built artifact from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Adjust permissions
RUN chown -R 10001:10001 /app

# Run as non-root user (UID 10001)
USER 10001:10001

# Expose Spring Boot default port
EXPOSE 8080

# Healthcheck using Spring Boot Actuator
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

# Launch the application with container memory awareness
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -Djava.security.egd=file:/dev/./urandom -jar app.jar"]

