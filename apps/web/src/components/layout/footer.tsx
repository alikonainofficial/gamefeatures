import { DEMO_MODE } from '@/lib/demo';

export function Footer() {
  if (!DEMO_MODE) return null;

  return (
    <footer className="border-t border-gray-200 py-6 text-center text-sm text-gray-500">
      Demo data may be reset. Please don&apos;t post personal information.
    </footer>
  );
}
