# Backup System Setup

## Overview
The SAGA Storage System includes automated nightly backups and manual backup functionality.

## Features

### 1. Nightly Automated Backups
- **Schedule**: Runs automatically at 3:00 AM EST every day
- **Format**: CSV file with all containers and samples
- **Filename**: `saga-nightly-backup-YYYY-MM-DD.csv`
- **Storage**: Stored in Supabase backups table

### 2. Manual Backups
- **Trigger**: Admin dashboard "Create Manual Backup" button
- **Format**: CSV file with all containers and samples
- **Filename**: `saga-manual-backup-YYYY-MM-DD_HH-MM-SS.csv`
- **Download**: Automatically downloads to user's device
- **Storage**: Metadata stored in database (file downloads immediately)

## CSV Format
Each backup includes the following columns:
- Container ID
- Container Name
- Location
- Layout
- Temperature
- Type
- Archived (Yes/No)
- Training (Yes/No)
- Sample Position
- Sample ID
- Sample Created
- Sample Updated
- Sample Archived (Yes/No)

## Database Setup

### 1. Create Backups Table
Run the migration in Supabase SQL Editor:
\`\`\`sql
-- File: db/migrations/2025-11-13-create-backups-table.sql
\`\`\`

### 2. (Optional) Create Storage Bucket
If you want to store nightly backups in Supabase Storage:
1. Go to Supabase → Storage → Create Bucket
2. Name: `backups`
3. Make it private
4. Set RLS policies as needed

## Vercel Configuration

The cron job is configured in `vercel.json`:
- **Schedule**: `0 8 * * *` (8:00 AM UTC = 3:00 AM EST)
- **Endpoint**: `/api/cron/nightly-backup`

### Environment Variables
Set these in Vercel dashboard:
- `SUPABASE_URL` - Already configured
- `SUPABASE_SERVICE_ROLE_KEY` - Already configured
- `CRON_SECRET` (optional) - For additional security on cron endpoint

## Testing

### Test Manual Backup
1. Go to Admin Dashboard → Backups tab
2. Click "Create Manual Backup"
3. CSV should download immediately
4. Check backups list for the new entry

### Test Nightly Backup (Local)
You can trigger the cron endpoint manually:
\`\`\`bash
curl -X POST https://your-domain.vercel.app/api/cron/nightly-backup \\
  -H "Authorization: Bearer YOUR_CRON_SECRET"
\`\`\`

## Monitoring
- Check Vercel logs for cron execution
- View backup history in Admin Dashboard
- Monitor Supabase `backups` table

## Notes
- Nightly backups do not overwrite manual backups
- CSV format is Excel-compatible
- All timestamps are stored in UTC but displayed in EST
- Backups include both active and archived containers/samples
