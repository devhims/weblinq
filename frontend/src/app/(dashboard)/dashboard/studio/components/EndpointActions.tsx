'use client';

import { API_ENDPOINTS } from '../endpoints';
import { useStudioParams } from '../hooks/useStudioParams';

export function EndpointActions() {
  const { endpoint, action } = useStudioParams();

  const endpointObj = API_ENDPOINTS.find((e) => e.id === endpoint);
  const actionObj = endpointObj?.subActions.find((a) => a.id === action);

  const Comp = actionObj?.Component;

  return Comp ? <Comp /> : null;
}
