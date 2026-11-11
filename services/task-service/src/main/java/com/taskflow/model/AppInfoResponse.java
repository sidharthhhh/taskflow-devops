package com.taskflow.model;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

/**
 * Data Transfer Object for application metadata endpoint (/api/info).
 */
@Schema(description = "System and application metadata response")
public class AppInfoResponse {

    @Schema(description = "Application name", example = "TaskFlow")
    private String name;

    @Schema(description = "Application version", example = "1.0.0")
    private String version;

    @Schema(description = "Application description", example = "TaskFlow REST API - End-to-End DevOps Project")
    private String description;

    @Schema(description = "System status", example = "UP")
    private String status;

    @Schema(description = "Database in use", example = "H2 In-Memory (or PostgreSQL)")
    private String database;

    @Schema(description = "Current server timestamp")
    private LocalDateTime timestamp;

    public AppInfoResponse() {
    }

    public AppInfoResponse(String name, String version, String description, String status, String database, LocalDateTime timestamp) {
        this.name = name;
        this.version = version;
        this.description = description;
        this.status = status;
        this.database = database;
        this.timestamp = timestamp;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getVersion() {
        return version;
    }

    public void setVersion(String version) {
        this.version = version;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getDatabase() {
        return database;
    }

    public void setDatabase(String database) {
        this.database = database;
    }

    public LocalDateTime getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(LocalDateTime timestamp) {
        this.timestamp = timestamp;
    }
}
