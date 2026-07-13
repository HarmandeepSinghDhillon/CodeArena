package com.coderunner.app.controllers;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;

@Controller
public class ViewController {

    @GetMapping({"/", "/dashboard"})
    public String serveDashboard(HttpServletRequest request) {
        if (hasAuthToken(request)) {
            return "forward:/index.html";
        }
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String serveLogin(HttpServletRequest request) {
        if (hasAuthToken(request)) {
            return "redirect:/dashboard";
        }
        return "forward:/index.html";
    }

    @GetMapping("/signup")
    public String serveSignup(HttpServletRequest request) {
        if (hasAuthToken(request)) {
            return "redirect:/dashboard";
        }
        return "forward:/index.html";
    }

    @GetMapping("/admin")
    public String serveAdmin(HttpServletRequest request) {
        // Assume logic validates admin role via token
        if (hasAuthToken(request)) {
            return "forward:/index.html";
        }
        return "redirect:/login";
    }

    private boolean hasAuthToken(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie c : cookies) {
                if ("auth_token".equals(c.getName())) return true;
            }
        }
        return false;
    }
}