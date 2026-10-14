package com.taskflow.controller;

import com.taskflow.exception.ErrorResponse;
import com.taskflow.model.TaskRequest;
import com.taskflow.model.TaskResponse;
import com.taskflow.model.TaskStatus;
import com.taskflow.service.TaskService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.ArraySchema;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

/**
 * REST Controller exposing CRUD operations on TaskFlow to-do tasks.
 */
@RestController
@RequestMapping("/api/tasks")
@Tag(name = "Tasks", description = "Endpoints for managing To-Do tasks")
public class TaskController {

    private final TaskService taskService;

    public TaskController(TaskService taskService) {
        this.taskService = taskService;
    }

    /**
     * GET /api/tasks - Retrieve all tasks, with optional status filter.
     */
    @Operation(summary = "Get all tasks", description = "Retrieves all tasks, optionally filtered by status (TODO, IN_PROGRESS, DONE)")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Tasks retrieved successfully",
                    content = @Content(array = @ArraySchema(schema = @Schema(implementation = TaskResponse.class))))
    })
    @GetMapping
    public ResponseEntity<List<TaskResponse>> getAllTasks(
            @Parameter(description = "Optional status filter (TODO, IN_PROGRESS, DONE)")
            @RequestParam(required = false) TaskStatus status) {
        List<TaskResponse> tasks = taskService.getAllTasks(status);
        return ResponseEntity.ok(tasks);
    }

    /**
     * GET /api/tasks/{id} - Retrieve a specific task by its ID.
     */
    @Operation(summary = "Get task by ID", description = "Retrieves a single task by its unique identifier")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Task found",
                    content = @Content(schema = @Schema(implementation = TaskResponse.class))),
            @ApiResponse(responseCode = "404", description = "Task not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @GetMapping("/{id}")
    public ResponseEntity<TaskResponse> getTaskById(
            @Parameter(description = "ID of the task to retrieve", example = "1")
            @PathVariable Long id) {
        TaskResponse task = taskService.getTaskById(id);
        return ResponseEntity.ok(task);
    }

    /**
     * POST /api/tasks - Create a new task. Returns 201 Created with Location header.
     */
    @Operation(summary = "Create a new task", description = "Creates a new task and returns HTTP 201 with Location header")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Task created successfully",
                    content = @Content(schema = @Schema(implementation = TaskResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation failed for title or payload",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PostMapping
    public ResponseEntity<TaskResponse> createTask(@Valid @RequestBody TaskRequest request) {
        TaskResponse createdTask = taskService.createTask(request);

        // Build the URI for the newly created resource: /api/tasks/{id}
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(createdTask.getId())
                .toUri();

        return ResponseEntity.created(location).body(createdTask);
    }

    /**
     * PUT /api/tasks/{id} - Update an existing task.
     */
    @Operation(summary = "Update an existing task", description = "Updates title, description, and status of an existing task")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Task updated successfully",
                    content = @Content(schema = @Schema(implementation = TaskResponse.class))),
            @ApiResponse(responseCode = "400", description = "Validation failed",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "Task not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> updateTask(
            @Parameter(description = "ID of the task to update", example = "1")
            @PathVariable Long id,
            @Valid @RequestBody TaskRequest request) {
        TaskResponse updatedTask = taskService.updateTask(id, request);
        return ResponseEntity.ok(updatedTask);
    }

    /**
     * DELETE /api/tasks/{id} - Delete a task by ID. Returns 204 No Content.
     */
    @Operation(summary = "Delete a task", description = "Deletes a task by its ID and returns HTTP 204 No Content")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Task deleted successfully"),
            @ApiResponse(responseCode = "404", description = "Task not found",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(
            @Parameter(description = "ID of the task to delete", example = "1")
            @PathVariable Long id) {
        taskService.deleteTask(id);
        return ResponseEntity.noContent().build();
    }
}
