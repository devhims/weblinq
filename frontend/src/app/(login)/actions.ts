'use server';

import { z } from 'zod';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import {
  validatedAction,
  validatedActionWithUser,
} from '@/lib/auth/actions-helper';

const signInSchema = z.object({
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100),
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { email, password } = data;

  const result = await auth.api.signInEmail({
    body: {
      email,
      password,
    },
    headers: await headers(),
  });

  if (!result.user) {
    return {
      error: 'Invalid email or password. Please try again.',
      email,
      password,
    };
  }

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo) {
    redirect(redirectTo);
  }

  redirect('/dashboard/studio');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { email, password, name } = data;

  console.log('signUp', data);

  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: name || email.split('@')[0], // Use part of email as name if not provided
    },
  });

  if (!result.user) {
    return {
      error: 'Failed to create user. Please try again.',
      email,
      password,
    };
  }

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo) {
    redirect(redirectTo);
  }

  redirect('/dashboard/studio');
});

export const signOut = validatedActionWithUser(
  z.object({}),
  async (_, __, user) => {
    await auth.api.signOut({
      headers: await headers(),
    });

    redirect('/sign-in');
  }
);

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(8).max(100),
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    if (currentPassword === newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password must be different from the current password.',
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'New password and confirmation password do not match.',
      };
    }

    // Verify current password first
    const verifyResult = await auth.api.signInEmail({
      body: {
        email: user.email,
        password: currentPassword,
      },
      headers: await headers(),
    });

    if (!verifyResult.user) {
      return {
        currentPassword,
        newPassword,
        confirmPassword,
        error: 'Current password is incorrect.',
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
      success: 'Password updated successfully.',
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100),
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    // Verify password using better-auth
    const verifyResult = await auth.api.signInEmail({
      body: {
        email: user.email,
        password,
      },
      headers: await headers(),
    });

    if (!verifyResult.user) {
      return {
        password,
        error: 'Incorrect password. Account deletion failed.',
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

    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address'),
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name, email } = data;

    // Update user data using better-auth
    const result = await auth.api.updateUser({
      body: {
        name,
      },
      headers: await headers(),
    });

    if (!result) {
      return {
        error: 'Failed to update account.',
        name,
        email,
      };
    }

    // If email is different, we need to verify it
    if (email !== user.email) {
      // Note: You'll need to implement email verification flow here
      // This might involve sending a verification email and waiting for confirmation
      // before actually updating the email
      return {
        error:
          'Email updates require verification. This feature is not implemented yet.',
        name,
        email,
      };
    }

    return { name, success: 'Account updated successfully.' };
  }
);
