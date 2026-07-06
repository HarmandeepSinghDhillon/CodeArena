package com.coderunner.app.models;

import jakarta.persistence.*;

@Entity
@Table(name = "problems")
public class Problem {
    @Id
    private Long id; // We manually manage this ID to match your frontend logic

    @Column(columnDefinition = "TEXT")
    private String jsonData; // Stores the entire JSON object (title, constraints, testcases, etc.)

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getJsonData() { return jsonData; }
    public void setJsonData(String jsonData) { this.jsonData = jsonData; }
}