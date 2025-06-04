export function ApiKeyManagerLoading() {
  return (
    <div className='bg-white rounded-lg shadow p-6'>
      {/* Header skeleton */}
      <div className='flex justify-between items-center mb-6'>
        <div>
          <div className='h-6 w-20 bg-gray-200 rounded-md animate-pulse mb-2'></div>
          <div className='h-4 w-80 bg-gray-200 rounded-md animate-pulse'></div>
        </div>
        <div className='w-32 h-10 bg-gray-200 rounded-md animate-pulse'></div>
      </div>

      {/* Stats section skeleton */}
      <div className='mb-6'>
        <div className='h-4 w-24 bg-gray-200 rounded-md animate-pulse'></div>
      </div>

      {/* API Keys list skeleton - matches actual API key items */}
      <div className='space-y-4'>
        {[1, 2, 3].map((i) => (
          <div key={i} className='border border-gray-200 rounded-lg p-4'>
            <div className='flex justify-between items-start'>
              <div className='flex-1 min-w-0'>
                {/* API key header */}
                <div className='flex items-center space-x-3 mb-2'>
                  <div
                    className={`h-5 bg-gray-200 rounded animate-pulse ${
                      i === 1 ? 'w-32' : i === 2 ? 'w-28' : 'w-36'
                    }`}
                  ></div>
                  <div className='w-16 h-5 bg-gray-200 rounded-full animate-pulse'></div>
                </div>

                {/* API key details */}
                <div className='space-y-2'>
                  {/* Key display */}
                  <div className='flex items-center gap-2'>
                    <div className='h-4 w-8 bg-gray-200 rounded animate-pulse'></div>
                    <div className='w-24 h-6 bg-gray-200 rounded animate-pulse'></div>
                  </div>

                  {/* Stats grid */}
                  <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1'>
                    <div className='h-4 w-24 bg-gray-200 rounded animate-pulse'></div>
                    <div className='h-4 w-28 bg-gray-200 rounded animate-pulse'></div>
                    <div className='h-4 w-32 bg-gray-200 rounded animate-pulse'></div>
                    <div className='h-4 w-26 bg-gray-200 rounded animate-pulse'></div>
                  </div>
                </div>
              </div>

              {/* Delete button skeleton */}
              <div className='w-16 h-8 bg-gray-200 rounded animate-pulse ml-4'></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
