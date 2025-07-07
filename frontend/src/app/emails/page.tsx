import { PasswordResetEmail } from '@/emails/password-reset-email';
import { VerificationEmail } from '@/emails/verification-email';

export default function Emails() {
  return (
    <div>
      <PasswordResetEmail
        resetUrl="https://www.weblinq.dev"
        userEmail="test@test.com"
      />
      <VerificationEmail
        verificationUrl="https://www.weblinq.dev"
        userEmail="test@test.com"
      />
    </div>
  );
}
