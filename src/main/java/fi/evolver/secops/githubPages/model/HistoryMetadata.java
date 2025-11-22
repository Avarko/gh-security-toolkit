package fi.evolver.secops.githubPages.model;

import com.google.gson.annotations.SerializedName;

/**
 * Concise metadata to be stored in the history:
 * branch, commit SHA, and repository.
 */
public class HistoryMetadata {

    public String branch;
    @SerializedName("commit")
    public String commit;
    public String repository;
}
