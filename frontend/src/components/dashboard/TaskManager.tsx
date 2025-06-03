import { fetchTasks } from '@/lib/task-actions';
import { TaskForm } from './TaskForm';
import { TaskToggle, TaskDelete } from './TaskActions';
import { RefreshButton } from './RefreshButton';

export async function TaskManager() {
  const tasks = await fetchTasks();

  return (
    <div className='bg-white p-6 rounded-lg shadow-sm border border-gray-200'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h2 className='text-xl font-semibold text-gray-900'>Task Manager</h2>
          <p className='text-sm text-gray-600 mt-1'>
            Powered by Durable Objects for per-user task isolation
          </p>
        </div>
        <RefreshButton />
      </div>

      <TaskForm />

      {/* Task list */}
      <div className='space-y-2'>
        {tasks.length === 0 ? (
          <p className='text-gray-500 text-center py-4'>
            No tasks yet. Create your first task above!
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className='flex items-center gap-3 p-3 border border-gray-200 rounded-md hover:bg-gray-50'
            >
              <TaskToggle taskId={task.id} done={task.done} />
              <span
                className={`flex-1 ${
                  task.done ? 'line-through text-gray-500' : 'text-gray-900'
                }`}
              >
                {task.name}
              </span>
              <span className='text-xs text-gray-400 font-mono'>
                #{task.id}
              </span>
              <TaskDelete taskId={task.id} taskName={task.name} />
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      {tasks.length > 0 && (
        <div className='mt-6 pt-4 border-t border-gray-200'>
          <div className='grid grid-cols-3 gap-4 text-center'>
            <div>
              <div className='text-2xl font-bold text-blue-600'>
                {tasks.length}
              </div>
              <div className='text-xs text-gray-500'>Total</div>
            </div>
            <div>
              <div className='text-2xl font-bold text-green-600'>
                {tasks.filter((t) => t.done).length}
              </div>
              <div className='text-xs text-gray-500'>Completed</div>
            </div>
            <div>
              <div className='text-2xl font-bold text-orange-600'>
                {tasks.filter((t) => !t.done).length}
              </div>
              <div className='text-xs text-gray-500'>Pending</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
