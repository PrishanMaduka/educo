import type { ReactNode } from 'react';

import { StaffShell } from '@/components/shell/StaffShell';

export default function StaffAppLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
