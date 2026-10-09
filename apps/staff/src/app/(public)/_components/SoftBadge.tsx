import { cn } from '@quad/ui';
import { cva } from 'class-variance-authority';
import {
  ArrowLeftRight,
  Calendar,
  Clock,
  CodeXml,
  Cookie,
  CreditCard,
  Cross,
  FileSearch,
  FileText,
  Flag,
  Globe,
  GraduationCap,
  Heart,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  Mail,
  MapPin,
  MessagesSquare,
  Monitor,
  Package,
  Power,
  Scale,
  School,
  ScrollText,
  Server,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';

import type { BadgeIcon, Tint } from '../_lib/article';

const ICONS: Record<BadgeIcon, LucideIcon> = {
  alert: TriangleAlert,
  audit: FileSearch,
  box: Package,
  calendar: Calendar,
  cap: GraduationCap,
  card: CreditCard,
  chat: MessagesSquare,
  clock: Clock,
  code: CodeXml,
  cookie: Cookie,
  cross: Cross,
  doc: FileText,
  door: LogOut,
  family: Users,
  flag: Flag,
  globe: Globe,
  heart: Heart,
  key: KeyRound,
  lock: Lock,
  mail: Mail,
  phone: Smartphone,
  pin: MapPin,
  power: Power,
  rule: ScrollText,
  scale: Scale,
  school: School,
  screen: Monitor,
  server: Server,
  shield: ShieldCheck,
  spark: Sparkles,
  swap: ArrowLeftRight,
  tiles: LayoutDashboard,
  user: User,
};

const badge = cva('grid flex-none place-items-center', {
  variants: {
    tone: {
      sky: 'bg-site-chip-sky-bg text-site-chip-sky-ink',
      pink: 'bg-site-chip-pink-bg text-site-chip-pink-ink',
      lime: 'bg-site-tag-good-bg text-site-tag-good-ink',
      orange: 'bg-site-chip-orange-bg text-site-chip-orange-ink',
      plain: 'bg-site-white text-site-on-vivid',
    },
    size: {
      sm: 'size-9 rounded-[11px]',
      md: 'size-10 rounded-xl',
      lg: 'size-11 rounded-[13px]',
      xl: 'size-12 rounded-[14px]',
      xxl: 'size-14 rounded-[17px]',
    },
  },
  defaultVariants: { tone: 'sky', size: 'lg' },
});

export type BadgeTone = Tint | 'plain';
export type BadgeSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

/** The four colours in turn, for sections that do not pick their own. */
export const TONES: readonly Tint[] = ['sky', 'pink', 'lime', 'orange'];

/**
 * A soft badge (design/pages.html): a tinted rounded square with a 2 px line drawing in the
 * matching ink. Decorative: the heading beside it says what it is.
 */
export function SoftBadge({
  icon,
  tone = 'sky',
  size = 'lg',
  className,
}: {
  icon: BadgeIcon;
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
}) {
  const Icon = ICONS[icon];
  return (
    <span aria-hidden="true" className={cn(badge({ tone, size }), className)}>
      <Icon className="size-[58%]" strokeWidth={2} focusable="false" />
    </span>
  );
}
