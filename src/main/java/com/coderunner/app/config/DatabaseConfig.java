package com.coderunner.app.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.jdbc.DataSourceBuilder;
import javax.sql.DataSource;
import java.net.URI;
import org.springframework.beans.factory.annotation.Value;

@Configuration
public class DatabaseConfig {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @Value("${spring.datasource.username:sa}")
    private String username;

    @Value("${spring.datasource.password:password}")
    private String password;

    @Bean
    public DataSource dataSource() {
        String cleanUrl = dbUrl;
        
        // Handle standard postgres:// or postgresql:// URLs (commonly provided by Supabase/Render)
        if (dbUrl != null && (dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://"))) {
            try {
                // Parse standard URI: postgres://user:password@host:port/database
                URI uri = new URI(dbUrl);
                String host = uri.getHost();
                int port = uri.getPort();
                String path = uri.getPath();
                String userInfo = uri.getUserInfo();
                
                String cleanUsername = username;
                String cleanPassword = password;
                
                if (userInfo != null && userInfo.contains(":")) {
                    String[] parts = userInfo.split(":", 2);
                    cleanUsername = parts[0];
                    cleanPassword = parts[1];
                }
                
                if (port == -1) {
                    port = 5432; // Default postgres port
                }
                
                // Format as JDBC postgres url
                cleanUrl = "jdbc:postgresql://" + host + ":" + port + path;
                if (!cleanUrl.contains("sslmode")) {
                    cleanUrl += "?sslmode=require";
                }
                
                return DataSourceBuilder.create()
                        .url(cleanUrl)
                        .username(cleanUsername)
                        .password(cleanPassword)
                        .driverClassName("org.postgresql.Driver")
                        .build();
            } catch (Exception e) {
                System.err.println("Failed to parse database URI: " + e.getMessage());
            }
        }
        
        // Default standard data source creation
        return DataSourceBuilder.create()
                .url(cleanUrl)
                .username(username)
                .password(password)
                .build();
    }
}
