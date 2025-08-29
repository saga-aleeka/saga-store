import React from 'react';
import sagaLogo from 'figma:asset/64588e517bd125623e5f91d657806eafe8768d13.png';

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