# Custom Sample and Container Types Feature

## Overview
This feature allows users to create and manage custom sample types and container types directly from the Admin Dashboard. All types are stored in the database and dynamically loaded throughout the application.

## Database Changes

### New Tables

#### `sample_types`
Stores custom sample types with the following fields:
- `id` (uuid, primary key)
- `name` (text, unique) - Display name of the sample type
- `description` (text, nullable) - Optional description
- `color` (text) - Hex color code for UI display (default: #6b7280)
- `default_temperature` (text, nullable) - Default storage temperature
- `is_system` (boolean) - Whether this is a built-in type (true) or user-created (false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Pre-populated system types:**
- PA Pools, DP Pools, cfDNA Tubes, DTC Tubes, MNC Tubes, Plasma Tubes, BC Tubes, IDT Plates

#### `container_types`
Stores custom container layouts with the following fields:
- `id` (uuid, primary key)
- `name` (text, unique) - Display name of the container type
- `description` (text, nullable) - Optional description
- `rows` (integer) - Number of rows in the grid (1-50)
- `columns` (integer) - Number of columns in the grid (1-50)
- `default_temperature` (text, nullable) - Default storage temperature
- `is_system` (boolean) - Whether this is a built-in type (true) or user-created (false)
- `created_at` (timestamptz)
- `updated_at` (timestamptz)

**Pre-populated system types:**
- 9x9 (81 positions), 5x5 (25 positions), 14x7 (98 positions)

### Migrations
Run the following migrations in order:
1. `db/migrations/2025-12-16-create-sample-types.sql`
2. `db/migrations/2025-12-16-create-container-types.sql`

## API Endpoints

### Sample Types (`/api/sample_types`)
- **GET** - List all sample types (ordered by system first, then alphabetically)
- **POST** - Create new sample type
  - Required: `name`, `color` (valid hex)
  - Optional: `description`, `default_temperature`
- **PUT** - Update existing sample type (system types cannot be modified)
  - Required: `id`
  - Optional: `name`, `description`, `color`, `default_temperature`
- **DELETE** - Delete sample type (system types cannot be deleted)
  - Query param: `id`

### Container Types (`/api/container_types`)
- **GET** - List all container types (ordered by system first, then alphabetically)
- **POST** - Create new container type
  - Required: `name`, `rows` (1-50), `columns` (1-50)
  - Optional: `description`, `default_temperature`
- **PUT** - Update existing container type (system types cannot be modified)
  - Required: `id`
  - Optional: `name`, `description`, `rows`, `columns`, `default_temperature`
- **DELETE** - Delete container type (system types cannot be deleted)
  - Query param: `id`

## UI Changes

### Admin Dashboard - New "Create" Tab
Located at: `Admin Dashboard > Create`

**Features:**
- Toggle between "Sample Types" and "Container Types" tabs
- Create new sample types with:
  - Name
  - Description (optional)
  - Color (color picker + hex input)
  - Default temperature
- Create new container types with:
  - Name
  - Description (optional)
  - Rows and columns (1-50 each)
  - Default temperature
  - Live preview of total positions
- View all existing types with visual previews
- Delete custom types (system types are protected)
- Visual grid preview for container types showing layout

### Container Filters
- Now dynamically loads sample types from database
- Automatically updates when new types are created
- Maintains color-coded filter buttons

### Container Create/Edit Drawers
- Sample type dropdown now populated from database
- Container dimension dropdown shows all container types with:
  - Type name
  - Grid dimensions (e.g., "9×9 = 81 positions")
- Automatically calculates total capacity based on selected container type
- Updates in real-time when new types are created

### Grid View
- Already supports dynamic dimensions
- Automatically renders grids based on container type settings
- No changes needed (already flexible)

## Event System
The application uses custom events to keep UI in sync:

- `sample_types_updated` - Fired when sample types are created/updated/deleted
- `container_types_updated` - Fired when container types are created/updated/deleted

Components automatically reload types when these events fire.

## Permissions
- **No admin restrictions** - All authenticated users can create/edit/delete custom types
- System types (pre-populated defaults) cannot be modified or deleted
- Only custom types (where `is_system = false`) can be edited or deleted

## Migration Instructions

1. **Apply database migrations:**
   ```bash
   # Run migrations in Supabase SQL editor or via migration tool
   # 1. Run 2025-12-16-create-sample-types.sql
   # 2. Run 2025-12-16-create-container-types.sql
   ```

2. **Deploy API endpoints:**
   - Ensure `/api/sample_types.ts` is deployed
   - Ensure `/api/container_types.ts` is deployed

3. **Deploy frontend changes:**
   - All UI components are updated to use dynamic types
   - No breaking changes - existing containers will continue to work

## Backward Compatibility
- Existing containers with legacy layout values (9x9, 5x5, 14x7) will continue to work
- System types match the previous hardcoded values
- No data migration needed for existing containers

## Notes
- Container types support grids up to 50×50 (2,500 positions)
- Sample type colors use hex format (#RRGGBB)
- Grid rendering automatically adjusts to any dimension
- The DP Pools special case (80 capacity instead of 81 for 9×9) is still respected
