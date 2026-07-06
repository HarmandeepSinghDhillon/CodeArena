package com.coderunner.app.controllers;

import com.coderunner.app.models.User;
import com.coderunner.app.repositories.UserRepository;
import com.coderunner.app.services.CodeExecutionService;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Key;
import java.time.LocalDateTime;
import java.util.Date;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api")
public class ApiController {

    @Autowired
    private CodeExecutionService executionService;

    @Autowired
    private UserRepository userRepository;

    // Generate a secure, in-memory key for signing JWTs
    private final String SECRET = "harisonputter9878harisonputter9878harisonputter9878"; 
    private final Key key = Keys.hmacShaKeyFor(SECRET.getBytes(java.nio.charset.StandardCharsets.UTF_8));

    @PostMapping("/run")
    public ResponseEntity<?> runCode(@RequestBody Map<String, String> payload) {
        String code = payload.get("code");
        String input = payload.getOrDefault("input", "");
        String language = payload.getOrDefault("language", "python");

        if (code == null || code.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No code provided"));
        }

        Map<String, Object> result = executionService.executeCode(code, input, language);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/signup")
    public ResponseEntity<?> signup(@RequestBody Map<String, String> payload, HttpServletResponse response) {
        String username = payload.get("username");
        String email = payload.get("email");
        String password = payload.get("password");

        if (userRepository.findByUsername(username).isPresent()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "Username already exists"));
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(password); // Note: In a production fintech app, you'd hash this with BCrypt!
        user.setRole("user");
        user.setCreatedAt(LocalDateTime.now());
        user.setLastActive(LocalDateTime.now());
        userRepository.save(user);

        setAuthCookie(user, response);
        return ResponseEntity.ok(Map.of("success", true, "role", "user", "username", username, "message", "Account created successfully!"));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload, HttpServletResponse response) {
        String username = payload.get("username");
        String password = payload.get("password");
        String role = payload.getOrDefault("role", "user");

        // Convenience hack: Auto-create an admin user if you try to log in as admin and it doesn't exist yet
        if ("admin".equals(username) && "admin".equals(role) && userRepository.findByUsername("admin").isEmpty()) {
            User adminUser = new User();
            adminUser.setUsername("admin");
            adminUser.setPassword(password);
            adminUser.setRole("admin");
            adminUser.setCreatedAt(LocalDateTime.now());
            userRepository.save(adminUser);
        }

        Optional<User> userOpt = userRepository.findByUsername(username);

        if (userOpt.isPresent() && userOpt.get().getPassword().equals(password) && userOpt.get().getRole().equals(role)) {
            User user = userOpt.get();
            if ("TEMPORARILY_DEACTIVATED".equals(user.getStatus())) {
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "Your account has been temporarily deactivated. Please contact support."));
            }
            if ("PERMANENTLY_DEACTIVATED".equals(user.getStatus())) {
                return ResponseEntity.status(403).body(Map.of("success", false, "message", "Your account has been permanently deactivated."));
            }
            user.setLastActive(LocalDateTime.now());
            userRepository.save(user);

            setAuthCookie(user, response);
            return ResponseEntity.ok(Map.of("success", true, "role", user.getRole(), "username", username, "message", "Welcome back " + username + "!"));
        }

        return ResponseEntity.status(401).body(Map.of("success", false, "message", "Invalid credentials or role"));
    }

    @GetMapping("/check-auth")
    public ResponseEntity<?> checkAuth(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("auth_token".equals(c.getName())) {
                    try {
                        // Validate the JWT
                        Claims claims = Jwts.parserBuilder().setSigningKey(key).build().parseClaimsJws(c.getValue()).getBody();
                        String username = (String) claims.get("username");
                        Optional<User> userOpt = userRepository.findByUsername(username);
                        String avatarUrl = "";
                        if (userOpt.isPresent()) {
                            User user = userOpt.get();
                            if ("TEMPORARILY_DEACTIVATED".equals(user.getStatus()) || "PERMANENTLY_DEACTIVATED".equals(user.getStatus())) {
                                return ResponseEntity.status(403).body(Map.of("authenticated", false, "message", "Account deactivated"));
                            }
                            if (user.getAvatarUrl() != null) {
                                avatarUrl = user.getAvatarUrl();
                            }
                        }
                        return ResponseEntity.ok(Map.of(
                                "authenticated", true,
                                "role", claims.get("role"),
                                "username", claims.get("username"),
                                "avatarUrl", avatarUrl
                        ));
                    } catch (Exception e) {
                        return ResponseEntity.status(401).body(Map.of("authenticated", false));
                    }
                }
            }
        }
        return ResponseEntity.status(401).body(Map.of("authenticated", false));
    }

    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        Cookie cookie = new Cookie("auth_token", "");
        cookie.setMaxAge(0);
        cookie.setPath("/");
        response.addCookie(cookie);
        return ResponseEntity.ok(Map.of("success", true, "message", "Logged out successfully"));
    }

    // Helper method to generate JWT and attach it as a Cookie
    private void setAuthCookie(User user, HttpServletResponse response) {
        String token = Jwts.builder()
                .setSubject(user.getId())
                .claim("username", user.getUsername())
                .claim("role", user.getRole())
                .setIssuedAt(new Date())
                .setExpiration(new Date(System.currentTimeMillis() + 86400000)) // 1 day validity
                .signWith(key)
                .compact();

        Cookie cookie = new Cookie("auth_token", token);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        // cookie.setSecure(true); // Uncomment this if you deploy to production with HTTPS
        response.addCookie(cookie);
    }
}