package com.coderunner.app.config;

import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import java.util.Map;

@Configuration
public class HibernateConfig {

    @Value("${spring.datasource.url}")
    private String dbUrl;

    @Bean
    public HibernatePropertiesCustomizer hibernatePropertiesCustomizer() {
        return new HibernatePropertiesCustomizer() {
            @Override
            public void customize(Map<String, Object> hibernateProperties) {
                if (dbUrl != null) {
                    String urlLower = dbUrl.toLowerCase();
                    if (urlLower.startsWith("postgres://") || 
                        urlLower.startsWith("postgresql://") || 
                        urlLower.startsWith("jdbc:postgresql://")) {
                        
                        System.out.println("[HibernateConfig] Explicitly setting dialect to PostgreSQLDialect");
                        hibernateProperties.put("hibernate.dialect", "org.hibernate.dialect.PostgreSQLDialect");
                    } else {
                        System.out.println("[HibernateConfig] Explicitly setting dialect to H2Dialect");
                        hibernateProperties.put("hibernate.dialect", "org.hibernate.dialect.H2Dialect");
                    }
                }
            }
        };
    }
}
