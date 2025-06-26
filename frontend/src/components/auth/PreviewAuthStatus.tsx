'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Key, LogOut, AlertCircle } from 'lucide-react';
import { isVercelPreview, isPreviewAuthenticated, removeApiKeyFromStorage } from '@/lib/utils';

export default function PreviewAuthStatus() {
  const [isPreview, setIsPreview] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsPreview(isVercelPreview());
    setIsAuthenticated(isPreviewAuthenticated());
  }, []);

  const handleSignOut = () => {
    removeApiKeyFromStorage();
    setIsAuthenticated(false);
    window.location.reload(); // Reload to show auth modal
  };

  if (!isPreview) {
    return null;
  }

  return (
    <div className="flex items-center space-x-2">
      <Badge variant={isAuthenticated ? 'default' : 'destructive'} className="text-xs">
        {isAuthenticated ? (
          <>
            <Key className="h-3 w-3 mr-1" />
            Preview Authenticated
          </>
        ) : (
          <>
            <AlertCircle className="h-3 w-3 mr-1" />
            Authentication Required
          </>
        )}
      </Badge>

      {isAuthenticated && (
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="h-6 px-2 text-xs">
          <LogOut className="h-3 w-3 mr-1" />
          Sign Out
        </Button>
      )}
    </div>
  );
}
