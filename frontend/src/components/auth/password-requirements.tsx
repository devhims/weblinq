import { Check, X } from 'lucide-react';
import {
  getPasswordRequirements,
  getSpecialCharsDisplay,
} from '@/lib/utils/password-validation';

interface PasswordRequirementsProps {
  password: string;
  className?: string;
}

export function PasswordRequirements({
  password,
  className = '',
}: PasswordRequirementsProps) {
  const requirements = getPasswordRequirements(password);

  const RequirementItem = ({ met, text }: { met: boolean; text: string }) => (
    <div
      className={`flex items-center gap-2 text-xs ${met ? 'text-green-600' : 'text-gray-500'}`}
    >
      {met ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <X className="h-3 w-3 text-gray-400" />
      )}
      <span>{text}</span>
    </div>
  );

  return (
    <div className={`space-y-1 ${className}`}>
      <RequirementItem
        met={requirements.minLength}
        text="At least 8 characters"
      />
      <RequirementItem
        met={requirements.hasUppercase}
        text="One uppercase letter"
      />
      <RequirementItem
        met={requirements.hasSpecialChar}
        text={`One special character (${getSpecialCharsDisplay()})`}
      />
    </div>
  );
}
