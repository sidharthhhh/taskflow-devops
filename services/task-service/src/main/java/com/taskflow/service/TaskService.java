package com.taskflow.service;

import com.taskflow.exception.TaskNotFoundException;
import com.taskflow.model.Task;
import com.taskflow.model.TaskRequest;
import com.taskflow.model.TaskResponse;
import com.taskflow.model.TaskStatus;
import com.taskflow.repository.TaskRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Service class implementing business logic for Task management.
 */
@Service
@Transactional
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskService(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    /**
     * Retrieve all tasks or filter by status if provided.
     *
     * @param status optional status filter
     * @return list of task responses
     */
    @Transactional(readOnly = true)
    public List<TaskResponse> getAllTasks(TaskStatus status) {
        List<Task> tasks;
        if (status != null) {
            tasks = taskRepository.findByStatus(status);
        } else {
            tasks = taskRepository.findAll();
        }
        return tasks.stream()
                .map(TaskResponse::fromEntity)
                .collect(Collectors.toList());
    }

    /**
     * Retrieve a single task by ID.
     *
     * @param id task ID
     * @return task response
     * @throws TaskNotFoundException if task does not exist
     */
    @Transactional(readOnly = true)
    public TaskResponse getTaskById(Long id) {
        Task task = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException(id));
        return TaskResponse.fromEntity(task);
    }

    /**
     * Create a new task.
     *
     * @param request creation request
     * @return created task response
     */
    public TaskResponse createTask(TaskRequest request) {
        TaskStatus status = request.getStatus() != null ? request.getStatus() : TaskStatus.TODO;
        Task task = new Task(request.getTitle(), request.getDescription(), status);
        Task savedTask = taskRepository.save(task);
        return TaskResponse.fromEntity(savedTask);
    }

    /**
     * Update an existing task.
     *
     * @param id task ID
     * @param request update payload
     * @return updated task response
     * @throws TaskNotFoundException if task does not exist
     */
    public TaskResponse updateTask(Long id, TaskRequest request) {
        Task existingTask = taskRepository.findById(id)
                .orElseThrow(() -> new TaskNotFoundException(id));

        existingTask.setTitle(request.getTitle());
        existingTask.setDescription(request.getDescription());
        if (request.getStatus() != null) {
            existingTask.setStatus(request.getStatus());
        }

        Task updatedTask = taskRepository.save(existingTask);
        return TaskResponse.fromEntity(updatedTask);
    }

    /**
     * Delete a task by ID.
     *
     * @param id task ID
     * @throws TaskNotFoundException if task does not exist
     */
    public void deleteTask(Long id) {
        if (!taskRepository.existsById(id)) {
            throw new TaskNotFoundException(id);
        }
        taskRepository.deleteById(id);
    }
}
