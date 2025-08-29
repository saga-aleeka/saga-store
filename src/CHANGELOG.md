# SAGA Storage System - Change Log

## Version 2.3.0 - Cross-Container Sample Movement (Current)

### New Features
- **Cross-Container Sample Movement**: Users can now move samples between containers by scanning existing sample IDs
- **Enhanced Duplicate Handling**: System automatically detects when a scanned sample exists in another container and moves it instead of showing duplicate errors
- **Improved Sample Movement Policy**: 
  - Archive containers: Allow all duplicates without restrictions
  - General population containers: Prevent duplicates but allow automatic sample movement from any container
- **Better Movement Notifications**: Enhanced alerts showing detailed source and destination container information
- **Source Container Occupancy Updates**: Automatically updates occupancy counts when samples are moved between containers

### Technical Improvements
- Updated `checkForDuplicateConflicts` function to identify source containers for movement
- Added `handleMoveSampleFromOtherContainer` function for cross-container operations
- Enhanced `handleBarcodeSubmit` workflow to handle movement scenarios
- Improved error messaging and user feedback
- Added proper history tracking for cross-container moves

### User Experience
- Scanning an existing sample ID now automatically moves it to the new position
- Clear notifications show sample movement between containers
- Updated policy information in the scanning interface
- Maintains existing workflow while adding powerful movement capabilities

---

## Version 2.2.0 - Enhanced Database Integration

### Features
- Full Supabase database integration with offline fallback
- Real-time collaboration with multi-user editing
- Enhanced audit trail with sample movement tracking
- Comprehensive conflict resolution system
- Improved database health monitoring

---

## Version 2.1.0 - Training and Archive System

### Features
- Training container designation with orange theme
- Archive container system with separate tab navigation
- Three-tab interface: Containers, Archive, Samples
- Enhanced sample search and filtering capabilities

---

## Version 2.0.0 - Multi-Container Dashboard

### Features
- Dynamic grid representations for different container types
- Support for 9x9 boxes, 5x5 boxes, 5x4 racks, and 9x9 racks
- Sample scanning with barcode support
- Detailed sample history tracking
- Container creation and management

---

## Version 1.0.0 - Initial Release

### Features
- Basic plasma sample storage tracking
- Single container support
- User initials tracking
- Local storage persistence