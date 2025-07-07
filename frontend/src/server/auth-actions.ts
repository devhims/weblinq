'use server';

import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { APIError } from 'better-auth/api';
import { db } from '@/db';
import { user } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validatePassword } from '@/lib/utils/password-validation';
import { headers } from 'next/headers';

interface State {
  errorMessage?: string | null;
  requiresVerification?: boolean;
  email?: string;
}

interface EmailCheckState {
  errorMessage?: string | null;
  emailExists?: boolean;
  email?: string;
}

interface EmailVerificationState {
  errorMessage?: string | null;
  successMessage?: string | null;
  requiresVerification?: boolean;
  email?: string;
}

export async function signIn(prevState: State, formData: FormData) {
  const rawFormData = {
    email: formData.get('email') as string,
    password: formData.get('pwd') as string,
  };

  const { email, password } = rawFormData;

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
    console.log('Signed in');
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 'UNAUTHORIZED':
          return { errorMessage: 'User Not Found.' };
        case 'BAD_REQUEST':
          return { errorMessage: 'Invalid email.' };
        case 'FORBIDDEN':
          // User exists but email is not verified
          try {
            await auth.api.sendVerificationEmail({
              body: { email },
            });
            return {
              requiresVerification: true,
              email,
              errorMessage:
                "Your email address is not verified. We've sent a new verification email to your inbox.",
            };
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            return {
              requiresVerification: true,
              email,
              errorMessage:
                'Your email address is not verified. Please check your inbox for a verification email.',
            };
          }
        default:
          return { errorMessage: 'Something went wrong.' };
      }
    }
    console.error('sign in with email has not worked', error);
    throw error;
  }
  redirect('/dashboard');
}

export async function signUp(prevState: State, formData: FormData) {
  const rawFormData = {
    email: formData.get('email') as string,
    password: formData.get('pwd') as string,
    firstName: formData.get('firstname'),
    lastName: formData.get('lastname'),
  };

  const { email, password, firstName, lastName } = rawFormData;

  try {
    await auth.api.signUpEmail({
      body: {
        name: `${firstName} ${lastName}`,
        email,
        password,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 'UNPROCESSABLE_ENTITY':
          return { errorMessage: 'User already exists.' };
        case 'BAD_REQUEST':
          return { errorMessage: 'Invalid email.' };
        default:
          return { errorMessage: 'Something went wrong.' };
      }
    }
    console.error('sign up with email and password has not worked', error);
  }
  redirect('/dashboard');
}

export async function checkEmailExists(
  prevState: EmailCheckState,
  formData: FormData,
): Promise<EmailCheckState> {
  const email = formData.get('email') as string;

  if (!email) {
    return { errorMessage: 'Email is required.' };
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { errorMessage: 'Please enter a valid email address.' };
  }

  try {
    const userInfo = await db.select().from(user).where(eq(user.email, email));
    const emailExists = userInfo.length > 0;

    return {
      emailExists,
      email,
      errorMessage: null,
    };
  } catch (error) {
    console.error('Error checking email existence:', error);
    return { errorMessage: 'Something went wrong. Please try again.' };
  }
}

export async function unifiedSignIn(prevState: State, formData: FormData) {
  const rawFormData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  };

  const { email, password } = rawFormData;

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password,
      },
    });
    console.log('Signed in');
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 'UNAUTHORIZED':
          return { errorMessage: 'Invalid password. Please try again.' };
        case 'BAD_REQUEST':
          return { errorMessage: 'Invalid email or password.' };
        case 'FORBIDDEN':
          // User exists but email is not verified
          try {
            await auth.api.sendVerificationEmail({
              body: { email },
            });
            return {
              requiresVerification: true,
              email,
              errorMessage:
                "Your email address is not verified. We've sent a new verification email to your inbox.",
            };
          } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            return {
              requiresVerification: true,
              email,
              errorMessage:
                'Your email address is not verified. Please check your inbox for a verification email.',
            };
          }
        default:
          return { errorMessage: 'Something went wrong.' };
      }
    }
    console.error('unified sign in has not worked', error);
    throw error;
  }
  redirect('/dashboard');
}

export async function unifiedSignUp(prevState: State, formData: FormData) {
  const rawFormData = {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
  };

  const { email, password, firstName, lastName } = rawFormData;

  // Validate password before calling better-auth
  const passwordValidation = validatePassword(password);
  if (!passwordValidation.isValid) {
    return {
      errorMessage: passwordValidation.errors.join(' '),
    };
  }

  // Basic validation for required fields
  if (!firstName?.toString().trim() || !lastName?.toString().trim()) {
    return { errorMessage: 'First name and last name are required.' };
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: `${firstName} ${lastName}`,
        email,
        password,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 'UNPROCESSABLE_ENTITY':
          // Check if user exists but is unverified
          try {
            const existingUser = await searchAccount(email);
            if (existingUser && !existingUser.emailVerified) {
              // User exists but email is not verified - resend verification
              try {
                await auth.api.sendVerificationEmail({
                  body: { email },
                });
                redirect(
                  `/verify-email?email=${encodeURIComponent(
                    email,
                  )}&resent=true`,
                );
              } catch (emailError) {
                console.error(
                  'Failed to resend verification email:',
                  emailError,
                );
                return {
                  errorMessage:
                    'Account exists but email not verified. Failed to resend verification email. Please try again.',
                };
              }
            } else {
              return {
                errorMessage:
                  'An account with this email already exists and is verified. Try signing in instead.',
              };
            }
          } catch (searchError) {
            console.error('Failed to check existing user:', searchError);
            return { errorMessage: 'User already exists.' };
          }
          break;
        case 'BAD_REQUEST':
          return { errorMessage: 'Invalid email or password format.' };
        default:
          return { errorMessage: 'Something went wrong.' };
      }
    }
    console.error('unified sign up has not worked', error);
    return { errorMessage: 'Something went wrong during sign up.' };
  }

  // Since email verification is required, we redirect to verification page instead of dashboard
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

export async function sendEmailVerification(
  prevState: EmailVerificationState,
  formData: FormData,
): Promise<EmailVerificationState> {
  const email = formData.get('email') as string;

  if (!email) {
    return { errorMessage: 'Email is required.' };
  }

  try {
    await auth.api.sendVerificationEmail({
      body: { email },
    });

    return {
      successMessage: 'Verification email sent! Please check your inbox.',
      email,
    };
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return {
      errorMessage: 'Failed to send verification email. Please try again.',
    };
  }
}

// Note: Email verification is now handled by /api/verify route
// This keeps the codebase cleaner and provides consistent new user detection

interface ForgotPasswordState {
  errorMessage?: string | null;
  successMessage?: string | null;
}

export async function forgotPassword(
  prevState: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = formData.get('email') as string;

  if (!email) {
    return { errorMessage: 'Email is required.' };
  }

  try {
    // First check if user exists and is unverified
    const existingUser = await searchAccount(email);

    if (existingUser && !existingUser.emailVerified) {
      // User exists but email is not verified - send verification email instead
      try {
        await auth.api.sendVerificationEmail({
          body: { email },
        });
        return {
          errorMessage:
            "Your email address is not verified yet. We've sent a verification email to your inbox. Please verify your email first, then you can reset your password.",
        };
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        return {
          errorMessage:
            'Your email address is not verified yet. Please check your inbox for a verification email and verify your account first.',
        };
      }
    }

    await auth.api.forgetPassword({
      body: {
        email,
        redirectTo: '/reset-password',
      },
    });

    return {
      errorMessage: null,
      successMessage: 'Password reset email sent! Please check your inbox.',
    };
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 'BAD_REQUEST':
          return { errorMessage: 'Invalid email address.' };
        case 'NOT_FOUND':
          return { errorMessage: 'No account found with this email address.' };
        default:
          return { errorMessage: 'Failed to send reset email.' };
      }
    }
    console.error('Forgot password failed:', error);
    return { errorMessage: 'Failed to send reset email.' };
  }
}

export async function resetPassword(prevState: State, formData: FormData) {
  const token = formData.get('token') as string;
  const newPassword = formData.get('newPassword') as string;

  if (!token) {
    return { errorMessage: 'Reset token is required.' };
  }

  if (!newPassword) {
    return { errorMessage: 'New password is required.' };
  }

  // Validate password using our comprehensive validation
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return {
      errorMessage: passwordValidation.errors.join(' '),
    };
  }

  try {
    await auth.api.resetPassword({
      body: {
        token,
        newPassword,
      },
    });
  } catch (error) {
    if (error instanceof APIError) {
      switch (error.status) {
        case 'BAD_REQUEST':
          return { errorMessage: 'Invalid or expired reset token.' };
        default:
          return { errorMessage: 'Password reset failed.' };
      }
    }
    console.error('Password reset failed:', error);
    return { errorMessage: 'Password reset failed.' };
  }
  redirect(
    '/sign-in?reset=success&message=Password+reset+successful.+Please+sign+in+with+your+new+password.',
  );
}

export async function searchAccount(email: string) {
  const userInfo = await db.select().from(user).where(eq(user.email, email));

  return userInfo.length > 0 ? userInfo[0] : null;
}

// Additional auth actions moved from (login)/actions.ts

export async function signOut(prevState: State, formData: FormData) {
  try {
    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    console.error('Sign out failed:', error);
    return { errorMessage: 'Failed to sign out. Please try again.' };
  }
  redirect('/sign-in');
}

interface UpdatePasswordState {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  errorMessage?: string;
  successMessage?: string;
}

export async function updatePassword(
  prevState: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const rawFormData = {
    currentPassword: formData.get('currentPassword') as string,
    newPassword: formData.get('newPassword') as string,
    confirmPassword: formData.get('confirmPassword') as string,
  };

  const { currentPassword, newPassword, confirmPassword } = rawFormData;

  // Basic validation
  if (!currentPassword || !newPassword || !confirmPassword) {
    return {
      ...rawFormData,
      errorMessage: 'All fields are required.',
    };
  }

  if (currentPassword === newPassword) {
    return {
      ...rawFormData,
      errorMessage: 'New password must be different from the current password.',
    };
  }

  if (confirmPassword !== newPassword) {
    return {
      ...rawFormData,
      errorMessage: 'New password and confirmation password do not match.',
    };
  }

  // Validate new password using our comprehensive validation
  const passwordValidation = validatePassword(newPassword);
  if (!passwordValidation.isValid) {
    return {
      ...rawFormData,
      errorMessage: passwordValidation.errors.join(' '),
    };
  }

  try {
    // Get current user session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        ...rawFormData,
        errorMessage: 'You must be signed in to change your password.',
      };
    }

    // Verify current password first
    const verifyResult = await auth.api.signInEmail({
      body: {
        email: session.user.email,
        password: currentPassword,
      },
      headers: await headers(),
    });

    if (!verifyResult.user) {
      return {
        ...rawFormData,
        errorMessage: 'Current password is incorrect.',
      };
    }

    // Update the password using the change password endpoint
    await auth.api.changePassword({
      body: {
        currentPassword,
        newPassword,
      },
      headers: await headers(),
    });

    return {
      successMessage: 'Password updated successfully.',
    };
  } catch (error) {
    console.error('Password update failed:', error);
    return {
      ...rawFormData,
      errorMessage: 'Failed to update password. Please try again.',
    };
  }
}

interface DeleteAccountState {
  password?: string;
  errorMessage?: string;
}

export async function deleteAccount(
  prevState: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const password = formData.get('password') as string;

  if (!password) {
    return {
      password,
      errorMessage: 'Password is required to delete your account.',
    };
  }

  try {
    // Get current user session
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session?.user) {
      return {
        password,
        errorMessage: 'You must be signed in to delete your account.',
      };
    }

    // Verify password using better-auth
    const verifyResult = await auth.api.signInEmail({
      body: {
        email: session.user.email,
        password,
      },
      headers: await headers(),
    });

    if (!verifyResult.user) {
      return {
        password,
        errorMessage: 'Incorrect password. Account deletion failed.',
      };
    }

    // Delete the user account
    await auth.api.deleteUser({
      body: {},
      headers: await headers(),
    });

    await auth.api.signOut({
      headers: await headers(),
    });
  } catch (error) {
    console.error('Account deletion failed:', error);
    return {
      password,
      errorMessage: 'Failed to delete account. Please try again.',
    };
  }

  redirect('/sign-in');
}
