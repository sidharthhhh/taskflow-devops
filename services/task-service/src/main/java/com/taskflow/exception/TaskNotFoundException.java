package com.taskflow.exception;

/**
 * Exception thrown when a requested Task is not found.
 */
public class TaskNotFoundException extends RuntimeException {

    public TaskNotFoundException(Long id) {
        super(String.format("Task not found with id: %d", id));
    }

    public TaskNotFoundException(String message) {
        super(message);
    }
}
