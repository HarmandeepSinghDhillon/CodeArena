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
        String cleanUsername = username;
        String cleanPassword = password;
        boolean isPostgres = false;

        if (dbUrl != null) {
            String urlLower = dbUrl.toLowerCase();
            if (urlLower.startsWith("postgres://") || urlLower.startsWith("postgresql://")) {
                isPostgres = true;
                try {
                    // Strip protocol prefix
                    String stripped = dbUrl.startsWith("postgres://") ? dbUrl.substring(11) : dbUrl.substring(13);
                    
                    int lastAt = stripped.lastIndexOf('@');
                    if (lastAt != -1) {
                        String credentials = stripped.substring(0, lastAt);
                        String connectionInfo = stripped.substring(lastAt + 1);
                        
                        int colonIndex = credentials.indexOf(':');
                        if (colonIndex != -1) {
                            cleanUsername = credentials.substring(0, colonIndex);
                            cleanPassword = credentials.substring(colonIndex + 1);
                        } else {
                            cleanUsername = credentials;
                        }
                        
                        // URL Decode credentials in case they contain encoded characters (like %40 for @)
                        cleanUsername = java.net.URLDecoder.decode(cleanUsername, java.nio.charset.StandardCharsets.UTF_8);
                        cleanPassword = java.net.URLDecoder.decode(cleanPassword, java.nio.charset.StandardCharsets.UTF_8);
                        
                        int slashIndex = connectionInfo.indexOf('/');
                        if (slashIndex != -1) {
                            String hostAndPort = connectionInfo.substring(0, slashIndex);
                            String databasePath = connectionInfo.substring(slashIndex);
                            
                            String host = hostAndPort;
                            int port = 5432;
                            int portColonIndex = hostAndPort.lastIndexOf(':');
                            if (portColonIndex != -1) {
                                host = hostAndPort.substring(0, portColonIndex);
                                try {
                                    port = Integer.parseInt(hostAndPort.substring(portColonIndex + 1));
                                } catch (NumberFormatException nfe) {}
                            }
                            
                            cleanUrl = "jdbc:postgresql://" + host + ":" + port + databasePath;
                        }
                    }
                } catch (Exception e) {
                    System.err.println("Failed to parse postgres connection URI: " + e.getMessage());
                }
            } else if (urlLower.startsWith("jdbc:postgresql://")) {
                isPostgres = true;
                // If it's already a JDBC URL, but it has credentials inside the URL, extract them
                // e.g. jdbc:postgresql://user:password@host:port/db
                int doubleSlashIndex = dbUrl.indexOf("//");
                if (doubleSlashIndex != -1) {
                    String afterSlash = dbUrl.substring(doubleSlashIndex + 2);
                    int atIndex = afterSlash.indexOf('@');
                    if (atIndex != -1) {
                        String credentials = afterSlash.substring(0, atIndex);
                        String hostAndPath = afterSlash.substring(atIndex + 1);
                        
                        int colonIndex = credentials.indexOf(':');
                        if (colonIndex != -1) {
                            cleanUsername = credentials.substring(0, colonIndex);
                            cleanPassword = credentials.substring(colonIndex + 1);
                        } else {
                            cleanUsername = credentials;
                        }
                        
                        try {
                            cleanUsername = java.net.URLDecoder.decode(cleanUsername, java.nio.charset.StandardCharsets.UTF_8);
                            cleanPassword = java.net.URLDecoder.decode(cleanPassword, java.nio.charset.StandardCharsets.UTF_8);
                        } catch (Exception e) {}
                        
                        cleanUrl = "jdbc:postgresql://" + hostAndPath;
                    }
                }
            }
        }

        // Enforce sslmode=require for cloud PostgreSQL instances
        if (isPostgres && cleanUrl != null && !cleanUrl.contains("sslmode")) {
            if (cleanUrl.contains("?")) {
                cleanUrl += "&sslmode=require";
            } else {
                cleanUrl += "?sslmode=require";
            }
        }

        System.out.println("[DatabaseConfig] Connecting to database: " + cleanUrl + " as user: " + cleanUsername);

        DataSource dataSource;
        if (isPostgres) {
            dataSource = DataSourceBuilder.create()
                    .url(cleanUrl)
                    .username(cleanUsername)
                    .password(cleanPassword)
                    .driverClassName("org.postgresql.Driver")
                    .build();
        } else {
            dataSource = DataSourceBuilder.create()
                    .url(cleanUrl)
                    .username(cleanUsername)
                    .password(cleanPassword)
                    .build();
        }

        // Test connection immediately to print clean diagnostic info if it fails
        try (java.sql.Connection conn = dataSource.getConnection()) {
            System.out.println("[DatabaseConfig] DATABASE CONNECTION VERIFICATION SUCCESSFUL!");
        } catch (java.sql.SQLException e) {
            System.err.println("[DatabaseConfig] ERROR: DATABASE CONNECTION VERIFICATION FAILED!");
            System.err.println("[DatabaseConfig] Error Code: " + e.getErrorCode());
            System.err.println("[DatabaseConfig] SQL State: " + e.getSQLState());
            e.printStackTrace();
        }

        return dataSource;
    }
}
