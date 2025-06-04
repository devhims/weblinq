export function TaskManagerLoading() {
  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      {/* Header skeleton */}
      <div className='flex items-center justify-between mb-6'>
        <div>
          <div className='h-7 w-16 bg-gray-200 rounded-md animate-pulse mb-2'></div>
          <div className='h-4 w-64 bg-gray-200 rounded-md animate-pulse'></div>
        </div>
      </div>

      {/* Form skeleton */}
      <div className='mb-6'>
        <div className='flex gap-2'>
          <div className='flex-1 h-10 bg-gray-200 rounded-md animate-pulse'></div>
          <div className='w-20 h-10 bg-gray-200 rounded-md animate-pulse'></div>
        </div>
      </div>

      {/* Task list skeleton - matches actual task items */}
      <div className='space-y-2'>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className='flex items-center gap-3 p-3 border border-gray-200 rounded-md'
          >
            {/* Checkbox skeleton */}
            <div className='w-4 h-4 bg-gray-200 rounded animate-pulse'></div>

            {/* Task name skeleton - varying widths for realism */}
            <div
              className={`h-4 bg-gray-200 rounded animate-pulse ${
                i === 1
                  ? 'flex-1 max-w-48'
                  : i === 2
                  ? 'flex-1 max-w-32'
                  : i === 3
                  ? 'flex-1 max-w-56'
                  : 'flex-1 max-w-40'
              }`}
            ></div>

            {/* Task ID skeleton */}
            <div className='w-8 h-3 bg-gray-200 rounded animate-pulse'></div>

            {/* Delete button skeleton */}
            <div className='w-12 h-6 bg-gray-200 rounded animate-pulse'></div>
          </div>
        ))}
      </div>

      {/* Stats skeleton */}
      <div className='mt-6 pt-4 border-t border-gray-200'>
        <div className='grid grid-cols-3 gap-4 text-center'>
          {[1, 2, 3].map((i) => (
            <div key={i}>
              <div className='h-8 w-8 bg-gray-200 rounded mx-auto animate-pulse mb-1'></div>
              <div className='h-3 w-16 bg-gray-200 rounded mx-auto animate-pulse'></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
