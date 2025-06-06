import { toast } from 'sonner';

const successStyle = {
  background: '#dcfce7',
  border: '1px solid #bbf7d0',
  color: '#166534',
};

const errorStyle = {
  background: '#fee2e2',
  border: '1px solid #fecaca',
  color: '#991b1b',
};

export const showSuccessToast = (message: string, duration?: number) => {
  return toast.success(message, {
    style: successStyle,
    duration: duration || 4000,
  });
};

export const showErrorToast = (message: string, duration?: number) => {
  return toast.error(message, {
    style: errorStyle,
    duration: duration || 4000,
  });
};

export const showInfoToast = (message: string, duration?: number) => {
  return toast.info(message, {
    duration: duration || 4000,
  });
};
