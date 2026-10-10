'use client';

import { ToastProvider } from '@quad/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { I18nProvider } from '@/i18n';

function Toasts({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  return <ToastProvider label={t('ui.toast.region')}>{children}</ToastProvider>;
}

/** Strings, TanStack Query and toasts for every console page (spec 02). */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  );
  return (
    <I18nProvider>
      <QueryClientProvider client={client}>
        <Toasts>{children}</Toasts>
      </QueryClientProvider>
    </I18nProvider>
  );
}
