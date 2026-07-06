package com.coderunner.app.models;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "progress")
public class Progress {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String userId;
    private String problemId;
    private boolean solved;
    private LocalDateTime solvedAt;
    private LocalDateTime lastAttempt;

    // Getters and Setters omitted for brevity
}