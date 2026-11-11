package com.taskflow.repository;

import com.taskflow.model.Task;
import com.taskflow.model.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Spring Data JPA repository for Task entity management.
 */
@Repository
public interface TaskRepository extends JpaRepository<Task, Long> {

    /**
     * Find tasks filtered by their status.
     *
     * @param status the task status (TODO, IN_PROGRESS, DONE)
     * @return list of tasks matching the status
     */
    List<Task> findByStatus(TaskStatus status);
}
