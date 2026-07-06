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
                // Strip the protocol prefix
                String stripped = dbUrl.startsWith("postgres://") ? dbUrl.substring(11) : dbUrl.substring(13);
                
                // Find the last '@' to split credentials from connection info
                int lastAt = stripped.lastIndexOf('@');
                if (lastAt == -1) {
                    throw new IllegalArgumentException("Invalid connection URL format");
                }
                
                String credentials = stripped.substring(0, lastAt);
                String connectionInfo = stripped.substring(lastAt + 1);
                
                // Parse username and password
                String cleanUsername = username;
                String cleanPassword = password;
                int colonIndex = credentials.indexOf(':');
                if (colonIndex != -1) {
                    cleanUsername = credentials.substring(0, colonIndex);
                    cleanPassword = credentials.substring(colonIndex + 1);
                }
                
                // Parse host, port, and database path
                int slashIndex = connectionInfo.indexOf('/');
                if (slashIndex == -1) {
                    throw new IllegalArgumentException("Missing database path");
                }
                
                String hostAndPort = connectionInfo.substring(0, slashIndex);
                String databasePath = connectionInfo.substring(slashIndex); // starts with '/'
                
                String host = hostAndPort;
                int port = 5432;
                int portColonIndex = hostAndPort.lastIndexOf(':');
                if (portColonIndex != -1) {
                    host = hostAndPort.substring(0, portColonIndex);
                    try {
                        port = Integer.parseInt(hostAndPort.substring(portColonIndex + 1));
                    } catch (NumberFormatException nfe) {
                        // ignore and use default port
                    }
                }
                
                // Format as JDBC postgres url
                cleanUrl = "jdbc:postgresql://" + host + ":" + port + databasePath;
                if (!cleanUrl.contains("sslmode")) {
                    if (cleanUrl.contains("?")) {
                        cleanUrl += "&sslmode=require";
                    } else {
                        cleanUrl += "?sslmode=require";
                    }
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
