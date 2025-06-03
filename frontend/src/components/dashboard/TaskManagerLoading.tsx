export function TaskManagerLoading() {
  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-xl font-semibold text-gray-900'>Task Manager</h2>
          <p className='text-sm text-gray-600 mt-1'>
            Powered by Durable Objects for per-user task isolation
          </p>
        </div>
      </div>

      {/* Loading form */}
      <div className='mb-6'>
        <div className='flex gap-2'>
          <div className='flex-1 h-10 bg-gray-200 rounded-md animate-pulse'></div>
          <div className='w-24 h-10 bg-gray-200 rounded-md animate-pulse'></div>
        </div>
      </div>

      {/* Loading task list */}
      <div className='space-y-2'>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className='flex items-center gap-3 p-3 border border-gray-200 rounded-md'
          >
            <div className='w-4 h-4 bg-gray-200 rounded animate-pulse'></div>
            <div className='flex-1 h-4 bg-gray-200 rounded animate-pulse'></div>
            <div className='w-8 h-4 bg-gray-200 rounded animate-pulse'></div>
            <div className='w-12 h-6 bg-gray-200 rounded animate-pulse'></div>
          </div>
        ))}
      </div>

      {/* Loading stats */}
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
