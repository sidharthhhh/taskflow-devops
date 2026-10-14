package com.taskflow.controller;

import com.taskflow.model.AppInfoResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.time.LocalDateTime;

/**
 * Controller providing system status, application info, and runtime database metadata.
 */
@RestController
@RequestMapping("/api/info")
@Tag(name = "Info", description = "Application and environment status endpoint")
public class InfoController {

    @Value("${spring.application.name:TaskFlow}")
    private String appName;

    @Value("${app.version:1.0.0}")
    private String appVersion;

    @Value("${app.description:TaskFlow REST API}")
    private String appDescription;

    private final DataSource dataSource;

    public InfoController(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Operation(summary = "Get application info", description = "Returns application status, version, and active database metadata")
    @ApiResponse(responseCode = "200", description = "Application information retrieved",
            content = @Content(schema = @Schema(implementation = AppInfoResponse.class)))
    @GetMapping
    public ResponseEntity<AppInfoResponse> getInfo() {
        String dbInfo = "Unknown";
        try (Connection connection = dataSource.getConnection()) {
            DatabaseMetaData metaData = connection.getMetaData();
            dbInfo = metaData.getDatabaseProductName() + " " + metaData.getDatabaseProductVersion();
        } catch (Exception e) {
            dbInfo = "Error reading database metadata: " + e.getMessage();
        }

        AppInfoResponse info = new AppInfoResponse(
                appName,
                appVersion,
                appDescription,
                "UP",
                dbInfo,
                LocalDateTime.now()
        );

        return ResponseEntity.ok(info);
    }
}
