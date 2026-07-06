package com.coderunner.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
            .csrf(csrf -> csrf.disable()) // Disable CSRF for your API requests
            .cors(cors -> cors.configurationSource(request -> {
                var opt = new CorsConfiguration();
                opt.setAllowedOrigins(List.of("*")); // Allow all for local dev
                opt.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
                opt.setAllowedHeaders(List.of("*"));
                return opt;
            }))
            .authorizeHttpRequests(auth -> auth
                // Allow everyone to see the frontend files and static assets
                .requestMatchers("/", "/*.html", "/login", "/signup", "/dashboard", "/admin").permitAll()
                // Allow access to ALL files inside your subdirectories
                .requestMatchers("/*_files/**", "/logo.png").permitAll() 
                // Allow access to your custom API endpoints
                .requestMatchers("/api/**").permitAll() 
                .anyRequest().authenticated()
            )
            .formLogin(form -> form.disable()) // Disable the "random" default login page
            .httpBasic(basic -> basic.disable());

        return http.build();
    }
}