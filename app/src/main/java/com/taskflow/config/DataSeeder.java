package com.taskflow.config;

import com.taskflow.model.Task;
import com.taskflow.model.TaskStatus;
import com.taskflow.repository.TaskRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Data seeder that populates 3 sample tasks on application startup if the database is empty.
 */
@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private final TaskRepository taskRepository;

    public DataSeeder(TaskRepository taskRepository) {
        this.taskRepository = taskRepository;
    }

    @Override
    public void run(String... args) {
        if (taskRepository.count() == 0) {
            log.info("Database is empty. Seeding initial TaskFlow sample data...");

            Task task1 = new Task(
                    "Set up development environment",
                    "Install Java 17, Maven, Docker, and configure IDE.",
                    TaskStatus.DONE
            );

            Task task2 = new Task(
                    "Implement TaskFlow REST API",
                    "Build Spring Boot controllers, services, repositories, and Swagger UI.",
                    TaskStatus.IN_PROGRESS
            );

            Task task3 = new Task(
                    "Configure Kubernetes manifests and CI/CD",
                    "Create k8s deployment, service, HPA, and GitHub Actions workflow.",
                    TaskStatus.TODO
            );

            taskRepository.saveAll(List.of(task1, task2, task3));
            log.info("Successfully seeded {} sample tasks.", taskRepository.count());
        } else {
            log.info("Database already contains {} tasks. Skipping seeder.", taskRepository.count());
        }
    }
}
