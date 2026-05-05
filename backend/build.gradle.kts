plugins {
    java
    jacoco
    id("io.quarkus")
    id("com.diffplug.spotless") version "8.4.0"
    id("com.github.spotbugs") version "6.5.4"
}

val quarkusPlatformVersion: String by project

repositories {
    mavenCentral()
}

dependencies {
    // Quarkus BOM
    implementation(enforcedPlatform("io.quarkus.platform:quarkus-bom:${quarkusPlatformVersion}"))

    // REST API
    implementation("io.quarkus:quarkus-rest")
    implementation("io.quarkus:quarkus-rest-jackson")
    implementation("io.quarkus:quarkus-hibernate-validator")

    // Database
    implementation("io.quarkus:quarkus-hibernate-orm-panache")
    implementation("io.quarkus:quarkus-jdbc-postgresql")
    implementation("io.quarkus:quarkus-flyway")
    implementation("jakarta.json.bind:jakarta.json.bind-api")

    // OpenAPI
    implementation("io.quarkus:quarkus-smallrye-openapi")

    // Health checks
    implementation("io.quarkus:quarkus-smallrye-health")
    implementation("io.quarkus:quarkus-scheduler")

    // Security & JWT
    implementation("io.quarkus:quarkus-smallrye-jwt")
    implementation("io.quarkus:quarkus-smallrye-jwt-build")
    implementation("at.favre.lib:bcrypt:0.10.2")

    // Configuration
    implementation("io.quarkus:quarkus-arc")
    implementation("com.github.ben-manes.caffeine:caffeine:3.2.3")

    // Image processing (thumbnailator for thumbnails, metadata-extractor for EXIF)
    implementation("net.coobird:thumbnailator:0.4.21")
    implementation("com.drewnoakes:metadata-extractor:2.20.0")

    // Testing
    testImplementation("io.quarkus:quarkus-junit5")
    testImplementation("io.quarkus:quarkus-junit5-mockito")
    testImplementation("io.quarkus:quarkus-jacoco")
    testImplementation("io.rest-assured:rest-assured")
    testImplementation("io.quarkus:quarkus-test-security")
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(25)
    }
}

tasks.withType<JavaCompile> {
    options.encoding = "UTF-8"
    options.compilerArgs.add("-parameters")
}

tasks.withType<Test> {
    systemProperty("java.util.logging.manager", "org.jboss.logmanager.LogManager")
}

// Code formatting
spotless {
    java {
        eclipse()
        formatAnnotations()
        removeUnusedImports()
        importOrder()
        endWithNewline()
    }
}

// Static analysis
spotbugs {
    excludeFilter = file("spotbugs-exclude.xml")
}

tasks.withType<com.github.spotbugs.snom.SpotBugsTask> {
    reports.create("html") { required = true }
    reports.create("xml") { required = false }
}

// Trivy vulnerability scan (requires trivy on PATH: brew install trivy)
tasks.register<Exec>("trivy") {
    group = "verification"
    description = "Scan built JARs for HIGH/CRITICAL CVEs using Trivy"
    dependsOn("quarkusBuild")
    commandLine(
        "trivy", "rootfs", "build/quarkus-app",
        "--severity", "HIGH,CRITICAL",
        "--ignore-unfixed",
        "--exit-code", "1",
        "--scanners", "vuln",
        "--ignorefile", ".trivyignore"
    )
}

// Disable Gradle JaCoCo agent — quarkus-jacoco handles instrumentation
tasks.withType<Test> {
    extensions.configure<JacocoTaskExtension> {
        isEnabled = false
    }
}

// Coverage verification (run explicitly, not part of build)
val quarkusExecData = layout.buildDirectory.file("jacoco/jacoco-quarkus.exec")

tasks.jacocoTestReport {
    executionData(quarkusExecData)
}

tasks.jacocoTestCoverageVerification {
    executionData(quarkusExecData)
    violationRules {
        rule {
            limit {
                counter = "INSTRUCTION"
                value = "COVEREDRATIO"
                minimum = "0.70".toBigDecimal()
            }
            limit {
                counter = "BRANCH"
                value = "COVEREDRATIO"
                minimum = "0.70".toBigDecimal()
            }
        }
    }
}
