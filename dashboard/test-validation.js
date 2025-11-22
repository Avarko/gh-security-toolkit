import { scanHistorySchema } from '../app/features/scans/model/historyTypes.ts';

const invalidData = {
    "version": "1.0",
    "scans": [
        {
            "timestamp": "not-a-valid-timestamp",
            "channel": "test@invalid!",
            "branch": "main",
            "commit": "abc123",
            "trivyFsResults": {
                "totalVulnerabilities": {
                    "CRITICAL": "not-a-number"
                }
            }
        }
    ]
};

const result = scanHistorySchema.safeParse(invalidData);

if (!result.success) {
    console.log('Validation errors:');
    result.error.issues.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.path.join('.')}: ${err.message}`);
    });
} else {
    console.log('Validation passed!');
}
