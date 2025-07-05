'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function DebugPolar() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message: string) => {
    setLogs((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const testCheckout = async () => {
    setIsLoading(true);
    addLog('Starting checkout test...');

    try {
      addLog('Checking environment variables...');
      addLog(
        `POLAR_PRO_PRODUCT_ID: ${process.env.NEXT_PUBLIC_POLAR_PRO_PRODUCT_ID || 'Not set'}`
      );

      addLog('Attempting to create checkout session...');
      await authClient.checkout({
        slug: 'pro',
      });
      addLog(
        'Checkout session created successfully - should redirect to Polar'
      );
    } catch (error: any) {
      addLog(`Checkout error: ${error.message}`);
      console.error('Full error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const testCustomerState = async () => {
    addLog('Fetching customer state...');
    try {
      const state = await authClient.customer.state();
      addLog(`Customer state: ${JSON.stringify(state, null, 2)}`);
    } catch (error: any) {
      addLog(`Customer state error: ${error.message}`);
    }
  };

  const clearLogs = () => setLogs([]);

  if (process.env.NODE_ENV === 'production') {
    return null; // Hide in production
  }

  return (
    <div className='fixed bottom-4 right-4 w-96 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-50 max-h-96 overflow-hidden'>
      <div className='flex justify-between items-center mb-2'>
        <h3 className='font-bold text-sm'>Polar Debug</h3>
        <button
          onClick={clearLogs}
          className='text-xs text-gray-500 hover:text-gray-700'
        >
          Clear
        </button>
      </div>

      <div className='space-y-2 mb-3'>
        <button
          onClick={testCheckout}
          disabled={isLoading}
          className='w-full bg-blue-500 text-white text-xs py-1 px-2 rounded disabled:bg-gray-300'
        >
          {isLoading ? 'Testing...' : 'Test Checkout'}
        </button>

        <button
          onClick={testCustomerState}
          className='w-full bg-green-500 text-white text-xs py-1 px-2 rounded'
        >
          Test Customer State
        </button>
      </div>

      <div className='bg-gray-100 rounded p-2 max-h-40 overflow-y-auto'>
        <div className='text-xs font-mono'>
          {logs.length === 0 ? (
            <div className='text-gray-500'>No logs yet...</div>
          ) : (
            logs.map((log, index) => (
              <div key={index} className='mb-1'>
                {log}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
