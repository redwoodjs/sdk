# 2025-09-24: Scheduled Cloudflare Worker Cleanup

## Problem

Test workers are not being consistently cleaned up, leading to an accumulation of old workers that can exceed Cloudflare's 500-worker limit and cause CI failures. The existing cleanup script only deletes workers based on name patterns, which is insufficient as it does not account for workers that may still be in use or those that are orphaned by failed CI runs.

## Plan

To address this, I will implement a more robust cleanup strategy that considers the age of the workers.

1.  **Modify the Cleanup Script**: I will update `scripts/cleanup-test-workers.sh` to fetch the creation date of each worker. The script will then identify and delete workers that both match the predefined test patterns and are older than a specified threshold (e.g., one hour). This prevents the deletion of workers from ongoing CI jobs. The number of workers deleted per run will be capped to prevent accidental mass deletions.

2.  **Scheduled Execution**: I will create a GitHub Actions workflow that runs the modified cleanup script on a schedule (e.g., every 15 minutes). This ensures that old workers are purged regularly and automatically.

This approach provides a more reliable and automated solution to keep the number of test workers under control without interfering with active test runs.
