import React from 'react';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';

interface EmailBadgeProps {
  email: string;
  onChangeEmail: () => void;
}

export function EmailBadge({ email, onChangeEmail }: EmailBadgeProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted rounded-lg mb-6">
      <div className="flex items-center space-x-2">
        <Icons.mail className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{email}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={onChangeEmail}
        className="text-xs"
      >
        Change
      </Button>
    </div>
  );
}
