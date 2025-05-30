import { InputHTMLAttributes, forwardRef } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', label, error, helperText, id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <div className='w-full'>
        {label && (
          <label
            htmlFor={inputId}
            className='block text-sm font-medium text-gray-700 mb-2'
          >
            {label}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          className={`
            block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm
            placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500
            ${
              error
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : ''
            }
            ${className}
          `}
          {...props}
        />
        {error && <p className='mt-1 text-sm text-red-600'>{error}</p>}
        {helperText && !error && (
          <p className='mt-1 text-sm text-gray-500'>{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
