'use client';

import {
  Avatar,
  avatarPalette,
  avatarTone,
  Button,
  buttonVariants,
  Card,
  Checkbox,
  Chip,
  cn,
  CommandPalette,
  Drawer,
  DropdownFilter,
  EmptyState,
  formatDate,
  formatMoney,
  GreetingScene,
  IconButton,
  initialsOf,
  Input,
  Kpi,
  PetalBurstProvider,
  Pill,
  Segmented,
  Select,
  Sparkline,
  Stepper,
  Switch,
  Table,
  Tabs,
  Textarea,
  Tooltip,
  usePetalBurst,
  useToast,
  type TableColumn,
} from '@quad/ui';
import { CalendarCheck, Info, Pencil, Plus, Receipt, Search, Trash2, UserPlus } from 'lucide-react';
import { useState, type ComponentType, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import {
  SAMPLE_CLASSES,
  SAMPLE_COLLECTED,
  SAMPLE_DATE,
  SAMPLE_KPI_VALUE,
  SAMPLE_OUTSTANDING,
  SAMPLE_STUDENTS,
  SAMPLE_TIME_ZONE,
  SAMPLE_TREND,
  type SampleStudent,
} from './sample-data';

import type { GreetingPeriod } from '@quad/domain';

const LOCALE = 'en-LK';

/** Two-column result row for the helper samples: what was passed, and what came back. */
function Result({ input, output }: { input: string; output: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
      <code className="min-w-0 rounded-md bg-surface-2 px-1.5 py-0.5 break-all text-ink">
        {input}
      </code>
      <span aria-hidden="true" className="text-ink-2">
        →
      </span>
      <span className="min-w-0 font-semibold break-all text-ink">{output}</span>
    </div>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2.5">{children}</div>;
}

function Stack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3">{children}</div>;
}

function AvatarSample() {
  return (
    <Row>
      {SAMPLE_STUDENTS.map((s) => (
        <Avatar key={s.id} name={s.name} size="sm" />
      ))}
      {SAMPLE_STUDENTS.map((s) => (
        <Avatar key={s.id} name={s.name} />
      ))}
    </Row>
  );
}

function ButtonSample() {
  const { t } = useTranslation();
  return (
    <Row>
      <Button icon={UserPlus}>{t('design.sample.addStudent')}</Button>
      <Button variant="secondary">{t('design.sample.save')}</Button>
      <Button variant="ghost">{t('design.sample.cancel')}</Button>
      <Button variant="danger" icon={Trash2}>
        {t('design.sample.remove')}
      </Button>
      <Button size="sm" variant="secondary">
        {t('design.sample.save')}
      </Button>
    </Row>
  );
}

function ButtonVariantsSample() {
  const { t } = useTranslation();
  return (
    <Row>
      <a href="#Button" className={buttonVariants({ variant: 'secondary' })}>
        {t('design.sample.linkButton')}
      </a>
    </Row>
  );
}

function CardSample() {
  const { t } = useTranslation();
  return (
    <Card
      title={t('design.sample.cardTitle')}
      actions={<IconButton icon={Pencil} label={t('design.sample.edit')} />}
    >
      <p className="m-0 p-4 text-[13.5px] text-ink-2">
        {t('design.sample.cardBody', {
          collected: formatMoney(SAMPLE_COLLECTED, LOCALE),
          due: formatMoney(SAMPLE_OUTSTANDING, LOCALE),
        })}
      </p>
    </Card>
  );
}

function CheckboxSample() {
  const { t } = useTranslation();
  return <Checkbox label={t('design.sample.consent')} defaultChecked />;
}

function ChipSample() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<'all' | 'overdue'>('all');
  return (
    <Row>
      <Chip
        selected={selected === 'all'}
        count={SAMPLE_STUDENTS.length}
        onClick={() => {
          setSelected('all');
        }}
      >
        {t('design.sample.chipAll')}
      </Chip>
      <Chip
        selected={selected === 'overdue'}
        count={2}
        onClick={() => {
          setSelected('overdue');
        }}
      >
        {t('design.sample.chipOverdue')}
      </Chip>
    </Row>
  );
}

function DropdownFilterSample() {
  const { t } = useTranslation();
  const [value, setValue] = useState<string | null>('7B');
  return (
    <DropdownFilter
      label={t('design.sample.class')}
      icon={CalendarCheck}
      value={value}
      options={SAMPLE_CLASSES.map((c) => ({ value: c, label: c }))}
      searchable
      onChange={setValue}
      onClear={() => {
        setValue(null);
      }}
    />
  );
}

function CommandPaletteSample() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="secondary"
        icon={Search}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('design.sample.openSearch')}
      </Button>
      {/* Mounted only while open: every palette listens for Ctrl K, and this page shows two. */}
      {open ? (
        <CommandPalette
          open
          onOpenChange={setOpen}
          groups={[
            {
              label: t('search.group.pages'),
              items: SAMPLE_STUDENTS.map((s) => ({
                id: s.id,
                label: s.name,
                hint: s.className,
                onSelect: () => {
                  setOpen(false);
                },
              })),
            },
          ]}
          placeholder={t('search.placeholder')}
          label={t('ui.palette.label')}
          emptyLabel={t('ui.filter.empty')}
        />
      ) : null}
    </>
  );
}

function stepLabels(t: ReturnType<typeof useTranslation>['t']): string[] {
  return [
    t('design.sample.stepDetails'),
    t('design.sample.stepGuardians'),
    t('design.sample.stepReview'),
  ];
}

function DrawerSample() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        icon={UserPlus}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('design.sample.openDrawer')}
      </Button>
      <Drawer
        open={open}
        onOpenChange={setOpen}
        eyebrow={t('design.sample.drawerEyebrow')}
        title={t('design.sample.addStudent')}
        icon={UserPlus}
        steps={stepLabels(t)}
        step={0}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('design.sample.cancel')}
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('design.sample.save')}
            </Button>
          </>
        }
      >
        <Stack>
          <p className="m-0 text-ink-2">{t('design.sample.drawerBody')}</p>
          <Input label={t('design.sample.studentName')} />
        </Stack>
      </Drawer>
    </>
  );
}

function StepperSample() {
  const { t } = useTranslation();
  return <Stepper steps={stepLabels(t)} current={1} />;
}

function EmptyStateSample() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Receipt}
      title={t('design.sample.emptyTitle')}
      description={t('design.sample.emptyBody')}
      action={<Button icon={Plus}>{t('design.sample.emptyAction')}</Button>}
    />
  );
}

const PERIODS: readonly GreetingPeriod[] = ['morning', 'afternoon', 'evening', 'night'];

function GreetingSceneSample() {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {PERIODS.map((period) => (
        <div
          key={period}
          className="relative h-[110px] overflow-hidden rounded-xl border border-line bg-surface"
        >
          <GreetingScene period={period} className="absolute inset-0 h-full w-full" />
        </div>
      ))}
    </div>
  );
}

function IconButtonSample() {
  const { t } = useTranslation();
  return (
    <Row>
      <IconButton icon={Pencil} label={t('design.sample.edit')} />
      <IconButton icon={Trash2} label={t('design.sample.remove')} />
    </Row>
  );
}

function InputSample() {
  const { t } = useTranslation();
  return (
    <Stack>
      <Input label={t('design.sample.studentName')} hint={t('design.sample.studentNameHint')} />
      <Input label={t('design.sample.studentName')} error={t('design.sample.studentNameError')} />
    </Stack>
  );
}

function KpiSample() {
  const { t } = useTranslation();
  return (
    <Kpi
      label={t('design.sample.attendanceToday')}
      value={SAMPLE_KPI_VALUE}
      delta={t('design.sample.attendanceDelta')}
      icon={CalendarCheck}
      tone="good"
    />
  );
}

function CelebrateButton() {
  const { t } = useTranslation();
  const { burst } = usePetalBurst();
  return (
    <Button
      variant="secondary"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        burst({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
      }}
    >
      {t('design.sample.celebrate')}
    </Button>
  );
}

function PetalBurstSample() {
  return (
    <PetalBurstProvider>
      <CelebrateButton />
    </PetalBurstProvider>
  );
}

function PillSample() {
  const { t } = useTranslation();
  return (
    <Row>
      <Pill tone="good">{t('design.sample.paid')}</Pill>
      <Pill tone="warn">{t('design.sample.dueSoon')}</Pill>
      <Pill tone="bad">{t('design.sample.overdue')}</Pill>
      <Pill tone="brand">{t('design.sample.students')}</Pill>
    </Row>
  );
}

function SegmentedSample() {
  const { t } = useTranslation();
  const [value, setValue] = useState('present');
  return (
    <Segmented
      label={t('design.sample.attendance')}
      value={value}
      onChange={setValue}
      options={[
        { value: 'present', label: t('design.sample.present'), tone: 'good' },
        { value: 'late', label: t('design.sample.late'), tone: 'warn' },
        { value: 'absent', label: t('design.sample.absent'), tone: 'bad' },
      ]}
    />
  );
}

function SelectSample() {
  const { t } = useTranslation();
  const [value, setValue] = useState<string>(SAMPLE_CLASSES[1]);
  return (
    <Select
      label={t('design.sample.class')}
      value={value}
      onValueChange={setValue}
      options={SAMPLE_CLASSES.map((c) => ({ value: c, label: c }))}
    />
  );
}

function SparklineSample() {
  const { t } = useTranslation();
  return (
    <Sparkline
      values={SAMPLE_TREND}
      trend="up"
      label={t('design.sample.attendanceTrend')}
      className="h-10 w-40"
    />
  );
}

function SwitchSample() {
  const { t } = useTranslation();
  return <Switch label={t('design.sample.feeReminders')} defaultChecked />;
}

function TableSample() {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const columns: TableColumn<SampleStudent>[] = [
    {
      key: 'name',
      header: t('design.sample.name'),
      sortable: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="flex items-center gap-2.5 font-semibold">
          <Avatar name={s.name} size="sm" decorative />
          {s.name}
        </span>
      ),
    },
    { key: 'class', header: t('design.sample.class'), cell: (s) => s.className, hideBelow: 'sm' },
    {
      key: 'due',
      header: t('design.sample.feesDue'),
      align: 'right',
      sortable: true,
      sortValue: (s) => s.due.amountMinor,
      cell: (s) => formatMoney(s.due, LOCALE),
    },
  ];
  return (
    <Table
      caption={t('design.sample.students')}
      columns={columns}
      rows={SAMPLE_STUDENTS}
      getRowId={(s) => s.id}
      rowLabel={(s) => s.name}
      selectable
      selectedIds={selected}
      onSelectionChange={setSelected}
    />
  );
}

function TabsSample() {
  const { t } = useTranslation();
  const tabs = [
    { value: 'overview', label: t('design.sample.overview') },
    { value: 'fees', label: t('design.sample.fees'), count: 2 },
    { value: 'attendance', label: t('design.sample.attendance') },
  ];
  return (
    <Tabs
      label={t('design.sample.students')}
      tabs={tabs.map((tab) => ({
        ...tab,
        panel: (
          <p className="m-0 pt-3 text-ink-2">{t('design.sample.tabPanel', { tab: tab.label })}</p>
        ),
      }))}
    />
  );
}

function TextareaSample() {
  const { t } = useTranslation();
  return <Textarea label={t('design.sample.notes')} rows={3} />;
}

/** The page wraps everything in one `ToastProvider`, so there is a single "Notifications" region. */
function ToastButton() {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() => {
        toast.show(t('design.sample.toast'));
      }}
    >
      {t('design.sample.showToast')}
    </Button>
  );
}

function TooltipSample() {
  const { t } = useTranslation();
  return (
    <Tooltip content={t('design.sample.tooltip')}>
      <IconButton icon={Info} label={t('design.sample.moreInfo')} />
    </Tooltip>
  );
}

function AvatarPaletteSample() {
  return (
    <Row>
      {avatarPalette.map((tone) => (
        <span
          key={tone.token}
          className={cn(
            'grid h-9 min-w-9 place-items-center rounded-full px-2 text-[11px] font-bold',
            tone.className,
          )}
        >
          {tone.token}
        </span>
      ))}
    </Row>
  );
}

function AvatarToneSample() {
  return (
    <Stack>
      {SAMPLE_STUDENTS.map((s) => (
        <Result key={s.id} input={`avatarTone('${s.name}')`} output={avatarTone(s.name).token} />
      ))}
    </Stack>
  );
}

function InitialsOfSample() {
  return (
    <Stack>
      {SAMPLE_STUDENTS.map((s) => (
        <Result key={s.id} input={`initialsOf('${s.name}')`} output={initialsOf(s.name)} />
      ))}
    </Stack>
  );
}

function CnSample() {
  return (
    <Result
      input="cn('px-2 text-ink', false, 'px-4')"
      output={cn('px-2 text-ink', false, 'px-4')}
    />
  );
}

function FormatDateSample() {
  return (
    <Stack>
      {(['short', 'long', 'weekday'] as const).map((style) => (
        <Result
          key={style}
          input={`formatDate(date, '${SAMPLE_TIME_ZONE}', '${style}')`}
          output={formatDate(SAMPLE_DATE, SAMPLE_TIME_ZONE, style)}
        />
      ))}
    </Stack>
  );
}

function FormatMoneySample() {
  return (
    <Stack>
      {[SAMPLE_COLLECTED, SAMPLE_STUDENTS[2].due].map((money) => (
        <Result
          key={money.amountMinor}
          input={`formatMoney({ amountMinor: ${money.amountMinor}, currency: '${money.currency}' }, '${LOCALE}')`}
          output={formatMoney(money, LOCALE)}
        />
      ))}
    </Stack>
  );
}

export interface StyleGuideEntry {
  /** The export's name in packages/ui/src/index.ts. */
  name: string;
  Sample: ComponentType;
}

/** One entry per value export of @quad/ui, in the order of packages/ui/src/index.ts. */
export const STYLE_GUIDE: readonly StyleGuideEntry[] = [
  { name: 'Avatar', Sample: AvatarSample },
  { name: 'Button', Sample: ButtonSample },
  { name: 'buttonVariants', Sample: ButtonVariantsSample },
  { name: 'Card', Sample: CardSample },
  { name: 'Checkbox', Sample: CheckboxSample },
  { name: 'Chip', Sample: ChipSample },
  { name: 'DropdownFilter', Sample: DropdownFilterSample },
  { name: 'CommandPalette', Sample: CommandPaletteSample },
  { name: 'Drawer', Sample: DrawerSample },
  { name: 'Stepper', Sample: StepperSample },
  { name: 'EmptyState', Sample: EmptyStateSample },
  { name: 'GreetingScene', Sample: GreetingSceneSample },
  { name: 'IconButton', Sample: IconButtonSample },
  { name: 'Input', Sample: InputSample },
  { name: 'Kpi', Sample: KpiSample },
  { name: 'PetalBurstProvider', Sample: PetalBurstSample },
  { name: 'usePetalBurst', Sample: PetalBurstSample },
  { name: 'Pill', Sample: PillSample },
  { name: 'Segmented', Sample: SegmentedSample },
  { name: 'Select', Sample: SelectSample },
  { name: 'Sparkline', Sample: SparklineSample },
  { name: 'Switch', Sample: SwitchSample },
  { name: 'Table', Sample: TableSample },
  { name: 'Tabs', Sample: TabsSample },
  { name: 'Textarea', Sample: TextareaSample },
  { name: 'ToastProvider', Sample: ToastButton },
  { name: 'useToast', Sample: ToastButton },
  { name: 'Tooltip', Sample: TooltipSample },
  { name: 'avatarPalette', Sample: AvatarPaletteSample },
  { name: 'avatarTone', Sample: AvatarToneSample },
  { name: 'initialsOf', Sample: InitialsOfSample },
  { name: 'cn', Sample: CnSample },
  { name: 'formatDate', Sample: FormatDateSample },
  { name: 'formatMoney', Sample: FormatMoneySample },
];
