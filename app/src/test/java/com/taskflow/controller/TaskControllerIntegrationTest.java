package com.taskflow.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.taskflow.TaskflowApplication;
import com.taskflow.model.Task;
import com.taskflow.model.TaskRequest;
import com.taskflow.model.TaskStatus;
import com.taskflow.repository.TaskRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Integration tests for TaskFlow REST API endpoints using MockMvc.
 */
@SpringBootTest(classes = TaskflowApplication.class)
@AutoConfigureMockMvc
@Transactional
class TaskControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TaskRepository taskRepository;

    @Test
    @DisplayName("GET /api/tasks should return all seeded tasks with HTTP 200")
    void testGetAllTasks_Returns200() throws Exception {
        mockMvc.perform(get("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(3))))
                .andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].title").exists())
                .andExpect(jsonPath("$[0].status").exists());
    }

    @Test
    @DisplayName("GET /api/tasks?status=DONE should return only DONE tasks")
    void testGetAllTasks_WithStatusFilter_Returns200() throws Exception {
        mockMvc.perform(get("/api/tasks")
                        .param("status", "DONE")
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].status", everyItem(is("DONE"))));
    }

    @Test
    @DisplayName("GET /api/tasks/{id} should return the task when ID exists")
    void testGetTaskById_Success() throws Exception {
        Task firstTask = taskRepository.findAll().get(0);

        mockMvc.perform(get("/api/tasks/{id}", firstTask.getId())
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstTask.getId()))
                .andExpect(jsonPath("$.title").value(firstTask.getTitle()));
    }

    @Test
    @DisplayName("GET /api/tasks/{id} with non-existent ID should return HTTP 404")
    void testGetTaskById_NotFound_Returns404() throws Exception {
        mockMvc.perform(get("/api/tasks/{id}", 9999L)
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.message", containsString("Task not found with id: 9999")));
    }

    @Test
    @DisplayName("POST /api/tasks should create task, return HTTP 201 and Location header")
    void testCreateTask_Success_Returns201AndLocationHeader() throws Exception {
        TaskRequest newRequest = new TaskRequest("Write Integration Tests", "Add full MockMvc tests", TaskStatus.IN_PROGRESS);

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newRequest)))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", matchesRegex(".*/api/tasks/\\d+")))
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.title").value("Write Integration Tests"))
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.createdAt").exists());
    }

    @Test
    @DisplayName("POST /api/tasks with empty title should return HTTP 400 Bad Request")
    void testCreateTask_ValidationFailure_Returns400() throws Exception {
        TaskRequest invalidRequest = new TaskRequest("", "No title provided", TaskStatus.TODO);

        mockMvc.perform(post("/api/tasks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.details", hasItem("Title must not be empty")));
    }

    @Test
    @DisplayName("PUT /api/tasks/{id} should update task and return HTTP 200")
    void testUpdateTask_Success_Returns200() throws Exception {
        Task firstTask = taskRepository.findAll().get(0);
        TaskRequest updateRequest = new TaskRequest("Updated Title", "Updated Description", TaskStatus.DONE);

        mockMvc.perform(put("/api/tasks/{id}", firstTask.getId())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(firstTask.getId()))
                .andExpect(jsonPath("$.title").value("Updated Title"))
                .andExpect(jsonPath("$.description").value("Updated Description"))
                .andExpect(jsonPath("$.status").value("DONE"));
    }

    @Test
    @DisplayName("PUT /api/tasks/{id} with unknown ID should return HTTP 404")
    void testUpdateTask_NotFound_Returns404() throws Exception {
        TaskRequest updateRequest = new TaskRequest("Updated Title", "Updated Description", TaskStatus.DONE);

        mockMvc.perform(put("/api/tasks/{id}", 9999L)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("DELETE /api/tasks/{id} should return HTTP 204 No Content")
    void testDeleteTask_Success_Returns204() throws Exception {
        Task taskToDelete = taskRepository.save(new Task("Temporary Task", "To be deleted", TaskStatus.TODO));

        mockMvc.perform(delete("/api/tasks/{id}", taskToDelete.getId()))
                .andExpect(status().isNoContent());

        // Verify task no longer exists
        mockMvc.perform(get("/api/tasks/{id}", taskToDelete.getId()))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("DELETE /api/tasks/{id} with unknown ID should return HTTP 404")
    void testDeleteTask_NotFound_Returns404() throws Exception {
        mockMvc.perform(delete("/api/tasks/{id}", 9999L))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404));
    }

    @Test
    @DisplayName("GET /api/info should return application metadata with HTTP 200")
    void testGetInfo_Returns200() throws Exception {
        mockMvc.perform(get("/api/info"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("TaskFlow"))
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").exists())
                .andExpect(jsonPath("$.timestamp").exists());
    }
}
