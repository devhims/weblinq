'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { useEffect, useRef } from 'react';
import { createTask, type ActionState } from '@/lib/task-actions';

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type='submit'
      disabled={pending}
      className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
    >
      {pending ? 'Creating...' : 'Add Task'}
    </button>
  );
}

export function TaskForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(
    createTask,
    null
  );
  const formRef = useRef<HTMLFormElement>(null);

  // Reset form after successful submission
  useEffect(() => {
    if (state?.success) {
      formRef.current?.reset();
    }
  }, [state?.success]);

  return (
    <div className='mb-6'>
      <form ref={formRef} action={formAction} className='flex gap-2'>
        <input
          type='text'
          name='name'
          placeholder='Enter task name...'
          required
          className='flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
        />
        <SubmitButton />
      </form>

      {state?.success && (
        <div className='mt-2 p-2 bg-green-50 border border-green-200 rounded-md'>
          <p className='text-green-600 text-sm'>{state.message}</p>
        </div>
      )}

      {state && !state.success && (
        <div className='mt-2 p-2 bg-red-50 border border-red-200 rounded-md'>
          <p className='text-red-600 text-sm'>{state.message}</p>
        </div>
      )}
    </div>
  );
}
