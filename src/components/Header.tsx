import React from 'react';
// If you are getting a "Cannot find module" error for the image import, 
// make sure the file exists at the specified path. 
// If it does not, you can use a placeholder or remove the import for now.

const sagaLogo = "/logo.png"; // Use a public/static path as a fallback

interface HeaderProps {
  actions?: React.ReactNode;
}

export function Header({ actions }: HeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <img 
            src={sagaLogo} 
            alt="SAGA Diagnostics" 
            className="h-8 md:h-10"
          />
          <p className="text-sm text-muted-foreground mt-1">
            Laboratory Storage System
          </p>
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}