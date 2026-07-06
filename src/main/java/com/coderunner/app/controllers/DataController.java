package com.coderunner.app.controllers;

import com.coderunner.app.models.Problem;
import com.coderunner.app.models.User;
import com.coderunner.app.repositories.ProblemRepository;
import com.coderunner.app.repositories.UserRepository;
import com.coderunner.app.services.CodeExecutionService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Key;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequestMapping("/api")
public class DataController {

    @Autowired private UserRepository userRepository;
    @Autowired private ProblemRepository problemRepository;
    @Autowired private CodeExecutionService executionService;
    
    private ObjectMapper mapper = new ObjectMapper();
    private final String SECRET = "harisonputter9878harisonputter9878harisonputter9878"; 
    private final Key key = Keys.hmacShaKeyFor(SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8));

    private User getUserFromToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("auth_token".equals(c.getName())) {
                    try {
                        Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(c.getValue()).getBody();
                        User u = userRepository.findByUsername((String) claims.get("username")).orElse(null);
                        if (u != null && ("TEMPORARILY_DEACTIVATED".equals(u.getStatus()) || "PERMANENTLY_DEACTIVATED".equals(u.getStatus()))) {
                            return null;
                        }
                        return u;
                    } catch (Exception e) { return null; }
                }
            }
        }
        return null;
    }

    // --- PROBLEM ENDPOINTS ---

    @GetMapping({"/problems", "/admin/problems"})
    public ResponseEntity<?> getProblems() {
        List<Map<String, Object>> problems = new ArrayList<>();
        for (Problem p : problemRepository.findAll()) {
            try {
                Map<String, Object> map = mapper.readValue(p.getJsonData(), new TypeReference<Map<String, Object>>() {});
                int solvedCount = 0;
                List<String> solvedBy = new ArrayList<>();
                for (User u : userRepository.findAll()) {
                    if ("user".equals(u.getRole())) {
                        try {
                            Map<String, Object> progress = mapper.readValue(u.getProgress(), new TypeReference<Map<String, Object>>() {});
                            if (progress.containsKey(p.getId().toString())) {
                                Map<String, Object> probProg = (Map<String, Object>) progress.get(p.getId().toString());
                                if ((Boolean) probProg.getOrDefault("solved", false)) {
                                    solvedCount++;
                                    solvedBy.add(u.getUsername());
                                }
                            }
                        } catch (Exception e) {}
                    }
                }
                map.put("solved_by_count", solvedCount);
                map.put("solved_by", solvedBy);
                problems.add(map);
            } catch (Exception e) {}
        }
        return ResponseEntity.ok(Map.of("problems", problems));
    }

    @PostMapping("/admin/problems")
    public ResponseEntity<?> addProblem(@RequestBody Map<String, Object> payload) {
        try {
            Long newId = problemRepository.findAll().stream().mapToLong(Problem::getId).max().orElse(0) + 1;
            payload.put("id", newId);
            Problem p = new Problem();
            p.setId(newId);
            p.setJsonData(mapper.writeValueAsString(payload));
            problemRepository.save(p);
            return ResponseEntity.ok(Map.of("success", true, "problem", payload));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/admin/problems/bulk")
    public ResponseEntity<?> addProblemsBulk(@RequestBody List<Map<String, Object>> payloads) {
        try {
            List<Problem> problemsToSave = new ArrayList<>();
            List<Map<String, Object>> savedPayloads = new ArrayList<>();
            Long nextId = problemRepository.findAll().stream().mapToLong(Problem::getId).max().orElse(0L) + 1L;
            
            for (Map<String, Object> payload : payloads) {
                payload.put("id", nextId);
                Problem p = new Problem();
                p.setId(nextId);
                p.setJsonData(mapper.writeValueAsString(payload));
                problemsToSave.add(p);
                savedPayloads.add(payload);
                nextId++;
            }
            problemRepository.saveAll(problemsToSave);
            return ResponseEntity.ok(Map.of("success", true, "count", savedPayloads.size(), "problems", savedPayloads));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }


    @PutMapping("/admin/problems/{id}")
    public ResponseEntity<?> updateProblem(@PathVariable Long id, @RequestBody Map<String, Object> payload) {
        try {
            payload.put("id", id);
            Problem p = problemRepository.findById(id).orElse(new Problem());
            p.setId(id);
            p.setJsonData(mapper.writeValueAsString(payload));
            problemRepository.save(p);
            return ResponseEntity.ok(Map.of("success", true, "problem", payload));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/admin/problems/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> deleteProblem(@PathVariable Long id) {
        // 1. Find all problems first
        List<Problem> allProblems = problemRepository.findAll();
        Problem deletedProblem = allProblems.stream()
                .filter(p -> p.getId().equals(id))
                .findFirst()
                .orElse(null);

        if (deletedProblem == null) {
            return ResponseEntity.ok(Map.of("success", true));
        }

        // Find all problems with ID > id
        List<Problem> problemsToShift = new ArrayList<>();
        for (Problem p : allProblems) {
            if (p.getId() > id) {
                problemsToShift.add(p);
            }
        }

        // Sort them by ID ascending to process them in order
        problemsToShift.sort(Comparator.comparing(Problem::getId));

        // Delete the deleted problem and all problems to shift first from DB (avoids primary key constraint violations)
        problemRepository.deleteById(id);
        for (Problem p : problemsToShift) {
            problemRepository.deleteById(p.getId());
        }
        problemRepository.flush();

        // Shift the IDs of the remaining problems down by 1
        List<Problem> shiftedProblems = new ArrayList<>();
        for (Problem p : problemsToShift) {
            long newId = p.getId() - 1;
            Problem newP = new Problem();
            newP.setId(newId);
            try {
                Map<String, Object> map = mapper.readValue(p.getJsonData(), new TypeReference<Map<String, Object>>() {});
                map.put("id", newId);
                newP.setJsonData(mapper.writeValueAsString(map));
            } catch (Exception e) {
                newP.setJsonData(p.getJsonData());
            }
            shiftedProblems.add(newP);
        }
        problemRepository.saveAll(shiftedProblems);
        problemRepository.flush();

        // 2. Remove the problem from every user's progress tracking and shift the remaining problem IDs
        List<User> usersToUpdate = new ArrayList<>();
        for (User u : userRepository.findAll()) {
            if (u.getProgress() != null && !u.getProgress().isEmpty()) {
                try {
                    Map<String, Object> progress = mapper.readValue(u.getProgress(), new TypeReference<Map<String, Object>>() {});
                    Map<String, Object> newProgress = new LinkedHashMap<>();
                    boolean modified = false;

                    for (Map.Entry<String, Object> entry : progress.entrySet()) {
                        try {
                            long entryId = Long.parseLong(entry.getKey());
                            if (entryId == id) {
                                modified = true; // removed
                            } else if (entryId > id) {
                                long newEntryId = entryId - 1;
                                newProgress.put(String.valueOf(newEntryId), entry.getValue());
                                modified = true; // shifted
                            } else {
                                newProgress.put(entry.getKey(), entry.getValue());
                            }
                        } catch (NumberFormatException e) {
                            newProgress.put(entry.getKey(), entry.getValue());
                        }
                    }

                    if (modified) {
                        u.setProgress(mapper.writeValueAsString(newProgress));
                        usersToUpdate.add(u);
                    }
                } catch (Exception e) {
                    System.err.println("Error parsing progress for user " + u.getUsername() + ": " + e.getMessage());
                }
            }
        }

        if (!usersToUpdate.isEmpty()) {
            userRepository.saveAll(usersToUpdate);
        }

        return ResponseEntity.ok(Map.of("success", true));
    }

    // --- USER & STATS ENDPOINTS ---

    @PostMapping("/user/heartbeat")
    public ResponseEntity<?> heartbeat(HttpServletRequest request) {
        User u = getUserFromToken(request);
        if (u != null) {
            u.setLastActive(LocalDateTime.now());
            userRepository.save(u);
        }
        return ResponseEntity.ok(Map.of("success", true));
    }

    @GetMapping("/user/progress")
    public ResponseEntity<?> getProgress(HttpServletRequest request) {
        User u = getUserFromToken(request);
        if (u == null) return ResponseEntity.status(401).build();
        try {
            Map<String, Object> progress = mapper.readValue(u.getProgress(), new TypeReference<Map<String, Object>>() {});
            long totalProblems = problemRepository.count();
            long solvedCount = progress.values().stream().filter(v -> (Boolean) ((Map)v).getOrDefault("solved", false)).count();
            List<Long> solvedIds = new ArrayList<>();
            progress.forEach((k, v) -> {
                if ((Boolean) ((Map)v).getOrDefault("solved", false)) solvedIds.add(Long.parseLong(k));
            });
            return ResponseEntity.ok(Map.of(
                "progress", progress,
                "stats", Map.of("total", totalProblems, "solved", solvedCount, "percentage", totalProblems > 0 ? (solvedCount * 100.0 / totalProblems) : 0),
                "solvedIds", solvedIds
            ));
        } catch (Exception e) { return ResponseEntity.badRequest().build(); }
    }

    @GetMapping("/admin/stats")
    public ResponseEntity<?> getStats() {
        long totalUsers = userRepository.findAll().stream().filter(u -> "user".equals(u.getRole())).count();
        long totalProblems = problemRepository.count();
        long totalSolved = 0;
        long activeCount = 0;
        LocalDateTime fiveMinsAgo = LocalDateTime.now().minusMinutes(5);

        for (User u : userRepository.findAll()) {
            if ("user".equals(u.getRole())) {
                try {
                    Map<String, Object> prog = mapper.readValue(u.getProgress(), new TypeReference<Map<String, Object>>() {});
                    totalSolved += prog.values().stream().filter(v -> (Boolean) ((Map)v).getOrDefault("solved", false)).count();
                } catch (Exception e) {}
                if (u.getLastActive() != null && u.getLastActive().isAfter(fiveMinsAgo)) activeCount++;
            }
        }
        return ResponseEntity.ok(Map.of("totalUsers", totalUsers, "totalProblems", totalProblems, "totalSubmissions", totalSolved, "activeUsers", activeCount));
    }

    @GetMapping("/admin/users")
    public ResponseEntity<?> getUsers() {
        List<Map<String, Object>> users = new ArrayList<>();
        LocalDateTime fiveMinsAgo = LocalDateTime.now().minusMinutes(5);
        long totalProblems = problemRepository.count();

        for (User u : userRepository.findAll()) {
            if ("user".equals(u.getRole())) {
                try {
                    Map<String, Object> prog = mapper.readValue(u.getProgress(), new TypeReference<Map<String, Object>>() {});
                    List<Map<String, Object>> solvedList = new ArrayList<>();
                    prog.forEach((k, v) -> {
                        Map<String, Object> pData = (Map<String, Object>) v;
                        if ((Boolean) pData.getOrDefault("solved", false)) {
                            String title = "Unknown";
                            Problem prob = problemRepository.findById(Long.parseLong(k)).orElse(null);
                            if (prob != null) {
                                try {
                                    Map<String, Object> probMap = mapper.readValue(prob.getJsonData(), new TypeReference<Map<String, Object>>() {});
                                    title = (String) probMap.getOrDefault("title", "Unknown");
                                } catch (Exception e) {}
                            }
                            solvedList.add(Map.of("problem_id", Integer.parseInt(k), "title", title, "solved_at", pData.get("solved_at")));
                        }
                    });

                    Map<String, Object> uMap = new HashMap<>();
                    uMap.put("id", u.getId());
                    uMap.put("username", u.getUsername());
                    uMap.put("email", u.getEmail() != null ? u.getEmail() : "");
                    uMap.put("created_at", u.getCreatedAt() != null ? u.getCreatedAt().toString() : "");
                    uMap.put("solved_count", solvedList.size());
                    uMap.put("solved_problems", solvedList);
                    uMap.put("is_active", u.getLastActive() != null && u.getLastActive().isAfter(fiveMinsAgo));
                    uMap.put("last_active", u.getLastActive() != null ? u.getLastActive().toString() : "");
                    uMap.put("progress", prog);
                    uMap.put("total_problems", totalProblems);
                    uMap.put("status", u.getStatus() != null ? u.getStatus() : "ACTIVE");
                    users.add(uMap);
                } catch (Exception e) {}
            }
        }
        return ResponseEntity.ok(Map.of("users", users));
    }

    @PutMapping("/admin/users/{id}/status")
    public ResponseEntity<?> updateUserStatus(@PathVariable String id, @RequestBody Map<String, String> payload) {
        try {
            String status = payload.get("status");
            User u = userRepository.findById(id).orElse(null);
            if (u == null) return ResponseEntity.notFound().build();
            u.setStatus(status);
            userRepository.save(u);
            return ResponseEntity.ok(Map.of("success", true, "user", u));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @DeleteMapping("/admin/users/{id}")
    public ResponseEntity<?> deleteUser(@PathVariable String id) {
        try {
            userRepository.deleteById(id);
            return ResponseEntity.ok(Map.of("success", true));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    // --- CODE SUBMISSION ENDPOINT ---
    
    @PostMapping("/submit")
    @SuppressWarnings("unchecked")
    public ResponseEntity<?> submitSolution(@RequestBody Map<String, Object> payload, HttpServletRequest request) {
        try {
            String code = (String) payload.get("code");
            String problemIdStr = String.valueOf(payload.get("problemId"));
            List<Map<String, String>> testCases = (List<Map<String, String>>) payload.get("testCases");
            String language = (String) payload.getOrDefault("language", "python");

            List<Map<String, Object>> results = new ArrayList<>();
            boolean allPassed = true;
            int passedCount = 0;

            for (int i = 0; i < testCases.size(); i++) {
                Map<String, String> tc = testCases.get(i);
                Map<String, Object> res = executionService.submitSolution(code, tc.get("input"), tc.get("expected"), language);
                
                Map<String, Object> resultEntry = new HashMap<>(res);
                resultEntry.put("testCase", i + 1);
                resultEntry.put("input", tc.get("input"));
                resultEntry.put("expected", tc.get("expected"));
                results.add(resultEntry);
                
                if ((Boolean) res.get("passed")) {
                    passedCount++;
                } else {
                    allPassed = false;
                }
            }

            if (allPassed) {
                User u = getUserFromToken(request);
                if (u != null) {
                    Map<String, Object> progress = mapper.readValue(u.getProgress(), new TypeReference<Map<String, Object>>() {});
                    Map<String, Object> problemProg = (Map<String, Object>) progress.getOrDefault(problemIdStr, new HashMap<>());
                    problemProg.put("solved", true);
                    problemProg.put("last_attempt", LocalDateTime.now().toString());
                    if (!problemProg.containsKey("solved_at")) problemProg.put("solved_at", LocalDateTime.now().toString());
                    
                    progress.put(problemIdStr, problemProg);
                    u.setProgress(mapper.writeValueAsString(progress));
                    userRepository.save(u);
                }
            }

            return ResponseEntity.ok(Map.of("success", allPassed, "results", results, "totalTests", testCases.size(), "passedTests", passedCount));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @org.springframework.beans.factory.annotation.Value("${supabase.url:}")
    private String supabaseUrl;

    @org.springframework.beans.factory.annotation.Value("${supabase.key:}")
    private String supabaseKey;

    @org.springframework.beans.factory.annotation.Value("${supabase.bucket:avatars}")
    private String supabaseBucket;

    @PostMapping("/user/avatar")
    public ResponseEntity<?> uploadAvatar(@RequestParam("file") org.springframework.web.multipart.MultipartFile file, HttpServletRequest request) {
        User u = getUserFromToken(request);
        if (u == null) return ResponseEntity.status(401).body(Map.of("error", "Unauthorized"));
        
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "File is empty"));
        }

        try {
            String avatarUrl = uploadToSupabaseStorage(file);
            if (avatarUrl == null) {
                return ResponseEntity.status(500).body(Map.of("error", "Failed to upload avatar (check Supabase configuration)"));
            }
            
            u.setAvatarUrl(avatarUrl);
            userRepository.save(u);
            
            return ResponseEntity.ok(Map.of("success", true, "avatarUrl", avatarUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    private String uploadToSupabaseStorage(org.springframework.web.multipart.MultipartFile file) {
        if (supabaseUrl == null || supabaseUrl.isEmpty() || supabaseKey == null || supabaseKey.isEmpty()) {
            System.err.println("Supabase URL or Key is not configured. Cannot upload avatar.");
            return null;
        }

        try {
            String filename = UUID.randomUUID().toString() + "_" + file.getOriginalFilename().replaceAll("[^a-zA-Z0-9._-]", "_");
            String uploadUrl = supabaseUrl + "/storage/v1/object/" + supabaseBucket + "/" + filename;

            java.net.http.HttpClient client = java.net.http.HttpClient.newHttpClient();
            java.net.http.HttpRequest httpRequest = java.net.http.HttpRequest.newBuilder()
                    .uri(java.net.URI.create(uploadUrl))
                    .header("Authorization", "Bearer " + supabaseKey)
                    .header("apikey", supabaseKey)
                    .header("Content-Type", file.getContentType() != null ? file.getContentType() : "image/jpeg")
                    .POST(java.net.http.HttpRequest.BodyPublishers.ofByteArray(file.getBytes()))
                    .build();

            java.net.http.HttpResponse<String> response = client.send(httpRequest, java.net.http.HttpResponse.BodyHandlers.ofString());

            if (response.statusCode() == 200) {
                return supabaseUrl + "/storage/v1/object/public/" + supabaseBucket + "/" + filename;
            } else {
                System.err.println("Supabase upload failed with status code " + response.statusCode() + ": " + response.body());
                return null;
            }
        } catch (Exception e) {
            System.err.println("Error uploading to Supabase: " + e.getMessage());
            return null;
        }
    }
}