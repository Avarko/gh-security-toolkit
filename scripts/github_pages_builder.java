///usr/bin/env jbang "$0" "$@" ; exit $?
//DEPS com.google.code.gson:gson:2.10.1
//DEPS org.freemarker:freemarker:2.3.33
//SOURCES ../src/main/java/fi/evolver/secops/githubPages/model/*.java
//SOURCES ../src/main/java/fi/evolver/secops/githubPages/loader/*.java
//SOURCES ../src/main/java/fi/evolver/secops/githubPages/transformer/*.java
//SOURCES ../src/main/java/fi/evolver/secops/githubPages/viewmodel/*.java
//SOURCES ../src/main/java/fi/evolver/secops/githubPages/renderer/*.java
//SOURCES ../src/main/java/fi/evolver/secops/githubPages/GitHubPagesBuilder.java

import fi.evolver.secops.githubPages.GitHubPagesBuilder;

/**
 * Backward-compatible wrapper for github_pages_builder.java
 *
 * Usage: jbang github_pages_builder.java <output_dir> <pages_root>
 * <scan_timestamp> <channel> [metadata_json]
 */
public class github_pages_builder {
    public static void main(String[] args) throws Exception {
        GitHubPagesBuilder.main(args);
    }
}
