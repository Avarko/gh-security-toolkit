package fi.evolver.secops.githubPages.model;

import java.util.ArrayList;
import java.util.List;

/**
 * Simple model for the scan history JSON format:
 *
 * {
 * "version": 2,
 * "scans": [ ... HistoryEntry ... ]
 * }
 */
public class ScanHistory {

    public int version = 2;
    public List<HistoryEntry> scans = new ArrayList<>();
}
