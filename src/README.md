# SAGA Storage System - StackBlitz Edition

## Overview

SAGA Storage System is a comprehensive clinical laboratory sample management platform designed for tracking plasma samples stored in -80°C freezers. This StackBlitz-compatible version runs entirely in the browser using localStorage for data persistence.

## Features

### Core Functionality
- **Container Management**: Create and manage different container types (9×9 boxes, 5×5 boxes, 5×4 racks, 9×9 racks)
- **Sample Tracking**: Track two primary sample types stored in -80°C:
  - BC Tubes (Blue) - stored in 9×9 boxes
  - Plasma Tubes (Yellow) - stored in 5×5 boxes
- **Visual Grid Interface**: Dynamic grid representations that adjust based on container type
- **Barcode Support**: Sample scanning with auto-advance workflow
- **Sample History**: Comprehensive tracking of sample movements and actions

### Advanced Features
- **Training Mode**: Special containers marked with orange theme for training purposes
- **Archive System**: Separate tab for archived containers with gray theme
- **Multi-tab Navigation**: Containers, Archive, and Samples tabs
- **Search & Filter**: Comprehensive search across containers and samples
- **Bulk Operations**: CSV import/export and bulk sample search
- **Audit Trail**: Complete system activity logging
- **Real-time Collaboration**: Simulated multi-user environment using browser events

### User Management
- **No Login Required**: Simple initials-based user tracking
- **Activity Monitoring**: Track user activities and system interactions
- **Conflict Resolution**: Handle simultaneous edits and data conflicts

## Technical Implementation

### Storage
- **LocalStorage**: Primary data persistence (containers, samples, audit logs)
- **Browser Events**: Real-time updates between browser tabs/windows
- **Health Checks**: Storage quota monitoring and error handling

### Components
- **React + TypeScript**: Modern component architecture
- **Tailwind CSS v4**: Custom design system with laboratory themes
- **ShadCN/UI**: Professional UI component library
- **Responsive Design**: Works on desktop and mobile devices

### Data Formats
- **Container Data**: JSON objects with metadata and occupancy tracking
- **Sample Data**: Position-based storage with complete history
- **Audit Logs**: Timestamped activity records with user attribution

## Getting Started

1. **Open in StackBlitz**: This application runs entirely in the browser
2. **Enter Your Initials**: Required for activity tracking (2+ characters)
3. **Create Containers**: Use the "Create New Container" button
4. **Add Samples**: Click on grid positions and scan/enter sample IDs
5. **Navigate Tabs**: Switch between Containers, Archive, and Samples views

## Admin Dashboard

Access the admin dashboard by adding `?admin=true` to the URL. Features include:

- **Mass Import**: CSV upload for containers and samples
- **Data Export**: Download system data as CSV
- **System Management**: View statistics and health information
- **Audit Logs**: Complete system activity history
- **Conflict Resolution**: Handle data conflicts and locks

## Sample Types & Containers

### Supported Sample Types
- **DP Pools**: 9×9 containers (80 effective capacity)
- **cfDNA Tubes**: 9×9 containers
- **DTC Tubes**: 9×9 containers  
- **MNC Tubes**: 9×9 containers
- **PA Pool Tubes**: 9×9 containers
- **Plasma Tubes**: 5×5 containers
- **BC Tubes**: 9×9 containers
- **IDT Plates**: 7×14 racks

### Container Types
- **9×9 Box**: 81 positions (80 for DP Pools)
- **5×5 Box**: 25 positions
- **5×4 Rack**: 20 positions
- **9×9 Rack**: 81 positions (80 for DP Pools)
- **7×14 Rack**: 98 positions

## Data Import/Export

### Grid Format (Recommended)
Auto-detects sample types from rack IDs and imports containers with samples:
```
cfDNA_RACK_001,Box Name:,cfDNA_BOX_001
,,1,2,3,4,5,6,7,8,9
,A,C00388cD010,C00395cD008,...
```

### Standard CSV Format
```csv
name,location,containerType,sampleType,temperature
"Plasma Box Alpha","Freezer A - Rack 1","5x5-box","Plasma Tubes","-80°C"
```

## System Requirements

- **Modern Web Browser**: Chrome, Firefox, Safari, Edge
- **JavaScript Enabled**: Required for application functionality
- **LocalStorage**: Minimum 5MB available storage
- **No Server Required**: Runs entirely client-side

## Limitations

- **Local Storage Only**: Data is browser-specific and not shared between devices
- **No Real Database**: Uses browser localStorage instead of server database
- **Demo Real-time**: Simulated collaboration using browser events
- **No Authentication**: Simple initials-based user tracking

## Version History

- **v2.3.0**: StackBlitz Edition with localStorage persistence
- **v2.2.0**: Enhanced Database (Supabase integration)
- **v2.1.0**: Real-time Collaboration
- **v2.0.0**: Advanced Features
- **v1.0.0**: Initial Release

## Support

This is a demonstration application. For production use in clinical laboratories, consider implementing:

- Server-side database (PostgreSQL, MongoDB)
- User authentication and authorization
- Real-time synchronization (WebSockets)
- Data backup and recovery systems
- Regulatory compliance features (FDA, CLIA)

---

**SAGA Storage System** - Advanced sample tracking for laboratory workflows