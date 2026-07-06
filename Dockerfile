# STAGE 1: Build the Java application
FROM maven:3.8.5-openjdk-17 AS build
WORKDIR /app

# Copy only the pom.xml first to fetch dependencies
COPY pom.xml .
RUN mvn dependency:go-offline

# Copy the source code
COPY src ./src

# Build the application
RUN mvn clean package -DskipTests

# STAGE 2: Create the final runtime image
FROM eclipse-temurin:17-jdk-jammy
WORKDIR /app

# Install Python 3 and g++ (required to run code execution logic)
RUN apt-get update && \
    apt-get install -y python3 g++ && \
    rm -rf /var/lib/apt/lists/*

# Copy the JAR from the build stage
COPY --from=build /app/target/app-0.0.1-SNAPSHOT.jar app.jar

EXPOSE 5000

# Start the Spring Boot application
CMD ["java", "-jar", "app.jar"]