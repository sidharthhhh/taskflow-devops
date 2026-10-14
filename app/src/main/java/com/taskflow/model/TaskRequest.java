package com.taskflow.model;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;

/**
 * Data Transfer Object for creating or updating a Task.
 */
@Schema(description = "Request body for creating or updating a task")
public class TaskRequest {

    @NotBlank(message = "Title must not be empty")
    @Schema(description = "Title of the task", example = "Build REST API", requiredMode = Schema.RequiredMode.REQUIRED)
    private String title;

    @Schema(description = "Detailed description of the task", example = "Implement CRUD endpoints and error handlers")
    private String description;

    @Schema(description = "Current status of the task", example = "TODO", allowableValues = {"TODO", "IN_PROGRESS", "DONE"})
    private TaskStatus status;

    public TaskRequest() {
    }

    public TaskRequest(String title, String description, TaskStatus status) {
        this.title = title;
        this.description = description;
        this.status = status;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }
}
