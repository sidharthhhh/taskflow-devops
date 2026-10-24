# ==========================================
# Stage 1: Build the Spring Boot JAR
# ==========================================
FROM maven:3.9-eclipse-temurin-17-alpine AS builder

WORKDIR /build

# Copy Maven POM and pre-fetch dependencies for layer caching
COPY app/pom.xml ./pom.xml
RUN mvn dependency:resolve -B

# Copy source code and package executable JAR (skip tests during container build)
COPY app/src ./src
RUN mvn clean package -DskipTests

# ==========================================
# Stage 2: Lightweight Runtime Environment
# ==========================================
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Create unprivileged system user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy built artifact from builder stage
COPY --from=builder /build/target/*.jar app.jar

# Adjust permissions
RUN chown -R appuser:appgroup /app

# Run as non-root user
USER appuser

# Expose Spring Boot default port
EXPOSE 8080

# Healthcheck using Spring Boot Actuator
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:8080/actuator/health || exit 1

# Launch the application
ENTRYPOINT ["java", "-Djava.security.egd=file:/dev/./urandom", "-jar", "app.jar"]
