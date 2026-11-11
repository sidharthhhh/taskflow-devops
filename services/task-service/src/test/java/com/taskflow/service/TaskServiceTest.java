package com.taskflow.service;

import com.taskflow.exception.TaskNotFoundException;
import com.taskflow.model.Task;
import com.taskflow.model.TaskRequest;
import com.taskflow.model.TaskResponse;
import com.taskflow.model.TaskStatus;
import com.taskflow.repository.TaskRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for TaskService using Mockito and JUnit 5.
 */
@ExtendWith(MockitoExtension.class)
class TaskServiceTest {

    @Mock
    private TaskRepository taskRepository;

    @InjectMocks
    private TaskService taskService;

    private Task sampleTask;

    @BeforeEach
    void setUp() {
        sampleTask = new Task("Test Task", "Test Description", TaskStatus.TODO);
        sampleTask.setId(1L);
        sampleTask.setCreatedAt(LocalDateTime.now());
        sampleTask.setUpdatedAt(LocalDateTime.now());
    }

    @Test
    @DisplayName("getAllTasks without filter should return all tasks")
    void testGetAllTasks_WithoutFilter() {
        when(taskRepository.findAll()).thenReturn(List.of(sampleTask));

        List<TaskResponse> result = taskService.getAllTasks(null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getTitle()).isEqualTo("Test Task");
        verify(taskRepository, times(1)).findAll();
        verify(taskRepository, never()).findByStatus(any());
    }

    @Test
    @DisplayName("getAllTasks with status filter should call findByStatus")
    void testGetAllTasks_WithStatusFilter() {
        when(taskRepository.findByStatus(TaskStatus.TODO)).thenReturn(List.of(sampleTask));

        List<TaskResponse> result = taskService.getAllTasks(TaskStatus.TODO);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).getStatus()).isEqualTo(TaskStatus.TODO);
        verify(taskRepository, times(1)).findByStatus(TaskStatus.TODO);
        verify(taskRepository, never()).findAll();
    }

    @Test
    @DisplayName("getTaskById with valid ID should return TaskResponse")
    void testGetTaskById_Success() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));

        TaskResponse result = taskService.getTaskById(1L);

        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getTitle()).isEqualTo("Test Task");
    }

    @Test
    @DisplayName("getTaskById with unknown ID should throw TaskNotFoundException")
    void testGetTaskById_NotFound() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> taskService.getTaskById(99L))
                .isInstanceOf(TaskNotFoundException.class)
                .hasMessageContaining("Task not found with id: 99");
    }

    @Test
    @DisplayName("createTask should save task and return TaskResponse")
    void testCreateTask_Success() {
        TaskRequest request = new TaskRequest("New Task", "New Desc", TaskStatus.IN_PROGRESS);
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task toSave = invocation.getArgument(0);
            toSave.setId(2L);
            toSave.setCreatedAt(LocalDateTime.now());
            toSave.setUpdatedAt(LocalDateTime.now());
            return toSave;
        });

        TaskResponse response = taskService.createTask(request);

        assertThat(response).isNotNull();
        assertThat(response.getId()).isEqualTo(2L);
        assertThat(response.getTitle()).isEqualTo("New Task");
        assertThat(response.getStatus()).isEqualTo(TaskStatus.IN_PROGRESS);
        verify(taskRepository, times(1)).save(any(Task.class));
    }

    @Test
    @DisplayName("createTask with null status should default to TODO")
    void testCreateTask_DefaultStatusToTodo() {
        TaskRequest request = new TaskRequest("No Status Task", "Desc", null);
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> {
            Task toSave = invocation.getArgument(0);
            toSave.setId(3L);
            toSave.setCreatedAt(LocalDateTime.now());
            toSave.setUpdatedAt(LocalDateTime.now());
            return toSave;
        });

        TaskResponse response = taskService.createTask(request);

        assertThat(response.getStatus()).isEqualTo(TaskStatus.TODO);
    }

    @Test
    @DisplayName("updateTask with valid ID should update fields and save")
    void testUpdateTask_Success() {
        when(taskRepository.findById(1L)).thenReturn(Optional.of(sampleTask));
        when(taskRepository.save(any(Task.class))).thenReturn(sampleTask);

        TaskRequest updateRequest = new TaskRequest("Updated Title", "Updated Desc", TaskStatus.DONE);
        TaskResponse response = taskService.updateTask(1L, updateRequest);

        assertThat(response.getTitle()).isEqualTo("Updated Title");
        assertThat(response.getDescription()).isEqualTo("Updated Desc");
        assertThat(response.getStatus()).isEqualTo(TaskStatus.DONE);
        verify(taskRepository, times(1)).save(sampleTask);
    }

    @Test
    @DisplayName("updateTask with unknown ID should throw TaskNotFoundException")
    void testUpdateTask_NotFound() {
        when(taskRepository.findById(99L)).thenReturn(Optional.empty());

        TaskRequest updateRequest = new TaskRequest("Title", "Desc", TaskStatus.DONE);
        assertThatThrownBy(() -> taskService.updateTask(99L, updateRequest))
                .isInstanceOf(TaskNotFoundException.class)
                .hasMessageContaining("Task not found with id: 99");

        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    @DisplayName("deleteTask with existing ID should delete successfully")
    void testDeleteTask_Success() {
        when(taskRepository.existsById(1L)).thenReturn(true);
        doNothing().when(taskRepository).deleteById(1L);

        taskService.deleteTask(1L);

        verify(taskRepository, times(1)).deleteById(1L);
    }

    @Test
    @DisplayName("deleteTask with unknown ID should throw TaskNotFoundException")
    void testDeleteTask_NotFound() {
        when(taskRepository.existsById(99L)).thenReturn(false);

        assertThatThrownBy(() -> taskService.deleteTask(99L))
                .isInstanceOf(TaskNotFoundException.class)
                .hasMessageContaining("Task not found with id: 99");

        verify(taskRepository, never()).deleteById(anyLong());
    }
}
