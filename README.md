# SagaStore

A modern laboratory sample management system for tracking biological samples across containers and locations. Built with React, TypeScript, and Supabase.

## Features

### Sample Management
- **Container Grid View**: Visual grid representation of sample locations within containers
- **Sample Tracking**: Track samples with positions, container assignments, and metadata
- **Worklist Management**: Import and manage sample worklists via CSV
- **Training Samples**: Designate samples as training with visual distinction
- **Archive System**: Archive samples and containers while maintaining history
- **Sample History**: Complete audit trail of sample movements and changes

### Container Management
- **Multiple Container Types**: Support for various container formats (9x9, 5x5, 14x7)
  - cfDNA Tubes
  - DP Pools (with I9 position restriction)
  - DTC Tubes
  - PA Pools
  - MNC Tubes
  - Plasma Tubes
  - BC Tubes
  - IDT Plates (14 rows × 7 columns with reversed numbering)
- **Container Details**: View and edit container metadata, layout, and temperature
- **Bulk Operations**: Create, edit, and archive multiple containers
- **Smart Position Finding**: Automatic next-available position detection

### Search & Filtering
- **Multi-term Search**: Search containers and samples with comma-separated values
- **Advanced Filters**: Filter by availability, training status, and container type
- **Pagination**: Configurable pagination (24/48/96 items per page)

### Admin Dashboard
- **CSV Import/Export**: Bulk import samples from CSV with grid or tabular format
- **Audit Trail**: Comprehensive logging of all system changes with pagination
- **Backup System**: Automated nightly backups with 14-day retention
- **User Management**: Manage authorized users and access tokens

### Scanning & Data Entry
- **Barcode Scanning**: Quick sample scanning with auto-advance to next position
- **Position Selection**: Manual or automatic position assignment
- **Keyboard Shortcuts**: Efficient data entry with keyboard navigation

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Vercel Serverless Functions
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Token-based authentication with authorized users
- **Testing**: Vitest, React Testing Library, MSW

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Supabase account and project
- Vercel account (for deployment)

### Installation

```bash
# Install dependencies
npm ci

# Start development server
npm run dev
```

### Environment Variables

Create a `.env.local` file with:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
CRON_SECRET=your_cron_secret
```

### Database Setup

Run the migrations in `/db/migrations/` in order:
1. Create authorized_users table
2. Create audit_logs table
3. Create backups table
4. Enable RLS policies
5. Add training sample flag
6. Add checkout fields
7. Create samples_upsert RPC function

## Scripts

- `npm run dev` — Start development server
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm test` — Run tests

## Project Structure

```
/api                    # Vercel serverless functions (backend)
  /auth                 # Authentication endpoints
  /containers           # Container CRUD operations
  /samples              # Sample CRUD operations
  /cron                 # Scheduled jobs (nightly backups)
/db/migrations          # Database schema migrations
/src
  /components           # React components
  /lib                  # Utilities (API client, auth, date utils)
  /mocks                # MSW mock handlers for testing
  App.tsx               # Main application component
  main.tsx              # Application entry point
/public                 # Static assets
```

## Key Components

- **App.tsx**: Main routing and state management
- **ContainerGridView**: Visual grid representation of containers
- **ContainerDetails**: Detailed view with scanning interface
- **WorklistManager**: CSV import and worklist tracking
- **AdminDashboard**: Admin tools for import, audit, backups, and users
- **SampleHistorySidebar**: Sample details and history viewer

## Deployment

The project is configured for Vercel deployment:

1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables
4. Deploy

The `vercel.json` configuration handles:
- API routes via serverless functions
- Cron job for nightly backups (3:00 AM EST)
- SPA routing fallback

## License

Private project - All rights reserved

## Support

For issues or questions, contact the project maintainer.