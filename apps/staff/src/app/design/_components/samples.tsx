'use client';

import {
  ActionMenu,
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
  DrawerClose,
  DropdownFilter,
  EmptyState,
  formatDate,
  formatMoney,
  formatRelative,
  GreetingScene,
  IconButton,
  initialsOf,
  Input,
  Kpi,
  OtpBoxes,
  PermissionMatrix,
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
  useLeaveGuard,
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
import { DESIGN_NS } from './strings';

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

function ActionMenuSample() {
  const { t } = useTranslation(DESIGN_NS);
  const toast = useToast();
  const name = SAMPLE_STUDENTS[0].name;
  return (
    <ActionMenu
      label={t('sample.actionMenu', { name })}
      items={[
        {
          id: 'reset',
          label: t('sample.resetPassword'),
          onSelect: () => {
            toast.show(t('sample.resetPassword'));
          },
        },
        {
          id: 'deactivate',
          label: t('sample.deactivate'),
          tone: 'danger',
          onSelect: () => {
            toast.show(t('sample.deactivate'));
          },
        },
      ]}
    />
  );
}

function PermissionMatrixSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [value, setValue] = useState<Record<string, Record<string, boolean>>>({
    fees: { view: true, create: false, edit: false },
    sis: { view: true, create: true, edit: false },
  });
  return (
    <PermissionMatrix
      caption={t('sample.matrixCaption')}
      columns={[
        { id: 'view', label: t('sample.matrixView') },
        { id: 'create', label: t('sample.matrixCreate') },
        { id: 'edit', label: t('sample.matrixEdit') },
      ]}
      rows={[
        { id: 'fees', label: t('sample.matrixFees') },
        { id: 'sis', label: t('sample.matrixRecords') },
        { id: 'transport', label: t('sample.matrixTransport'), notInPlan: true },
      ]}
      value={value}
      onToggle={(module, action, checked) => {
        setValue((current) => ({ ...current, [module]: { ...current[module], [action]: checked } }));
      }}
    />
  );
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
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Row>
      <Button icon={UserPlus}>{t('sample.addStudent')}</Button>
      <Button variant="secondary">{t('sample.save')}</Button>
      <Button variant="ghost">{t('sample.cancel')}</Button>
      <Button variant="danger" icon={Trash2}>
        {t('sample.remove')}
      </Button>
      <Button size="sm" variant="secondary">
        {t('sample.save')}
      </Button>
    </Row>
  );
}

function ButtonVariantsSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Row>
      <a href="#Button" className={buttonVariants({ variant: 'secondary' })}>
        {t('sample.linkButton')}
      </a>
    </Row>
  );
}

function CardSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Card
      title={t('sample.cardTitle')}
      actions={<IconButton icon={Pencil} label={t('sample.edit')} />}
    >
      <p className="m-0 p-4 text-[13.5px] text-ink-2">
        {t('sample.cardBody', {
          collected: formatMoney(SAMPLE_COLLECTED, LOCALE),
          due: formatMoney(SAMPLE_OUTSTANDING, LOCALE),
        })}
      </p>
    </Card>
  );
}

function OtpBoxesSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [code, setCode] = useState('12');
  return (
    <OtpBoxes
      label={t('sample.otpLabel')}
      digitLabel={(position, count) => t('sample.otpDigit', { position, count })}
      value={code}
      onChange={setCode}
      className="max-w-[360px]"
    />
  );
}

function CheckboxSample() {
  const { t } = useTranslation(DESIGN_NS);
  return <Checkbox label={t('sample.consent')} defaultChecked />;
}

function ChipSample() {
  const { t } = useTranslation(DESIGN_NS);
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
        {t('sample.chipAll')}
      </Chip>
      <Chip
        selected={selected === 'overdue'}
        count={2}
        onClick={() => {
          setSelected('overdue');
        }}
      >
        {t('sample.chipOverdue')}
      </Chip>
    </Row>
  );
}

function DropdownFilterSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [value, setValue] = useState<string | null>('7B');
  return (
    <DropdownFilter
      label={t('sample.class')}
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
  const { t } = useTranslation(DESIGN_NS);
  const { t: tApp } = useTranslation();
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
        {t('sample.openSearch')}
      </Button>
      {/* Mounted only while open: every palette listens for Ctrl K, and this page shows two. */}
      {open ? (
        <CommandPalette
          open
          onOpenChange={setOpen}
          groups={[
            {
              label: tApp('search.group.pages'),
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
          placeholder={tApp('search.placeholder')}
          label={tApp('ui.palette.label')}
          emptyLabel={tApp('ui.filter.empty')}
        />
      ) : null}
    </>
  );
}

function useStepLabels(): string[] {
  const { t } = useTranslation(DESIGN_NS);
  return [t('sample.stepDetails'), t('sample.stepGuardians'), t('sample.stepReview')];
}

function DrawerSample() {
  const { t } = useTranslation(DESIGN_NS);
  const stepLabels = useStepLabels();
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  return (
    <>
      <Button
        icon={UserPlus}
        onClick={() => {
          setOpen(true);
        }}
      >
        {t('sample.openDrawer')}
      </Button>
      <Drawer
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setDirty(false);
        }}
        dirty={dirty}
        eyebrow={t('sample.drawerEyebrow')}
        title={t('sample.addStudent')}
        icon={UserPlus}
        steps={stepLabels}
        step={0}
        footer={
          <>
            {/* DrawerClose: Cancel closes the way Escape does, so a dirty drawer asks first. */}
            <DrawerClose asChild>
              <Button variant="ghost">{t('sample.cancel')}</Button>
            </DrawerClose>
            <Button
              onClick={() => {
                setOpen(false);
              }}
            >
              {t('sample.save')}
            </Button>
          </>
        }
      >
        <Stack>
          <p className="m-0 text-ink-2">{t('sample.drawerBody')}</p>
          <Input
            label={t('sample.studentName')}
            onChange={(event) => {
              setDirty(event.target.value !== '');
            }}
          />
        </Stack>
      </Drawer>
    </>
  );
}

function LeaveGuardSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [holding, setHolding] = useState(false);
  useLeaveGuard(holding, t('sample.leaveGuardMessage'));
  return (
    <Switch label={t('sample.leaveGuard')} checked={holding} onCheckedChange={setHolding} />
  );
}

function StepperSample() {
  return <Stepper steps={useStepLabels()} current={1} />;
}

function EmptyStateSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <EmptyState
      icon={Receipt}
      title={t('sample.emptyTitle')}
      description={t('sample.emptyBody')}
      action={<Button icon={Plus}>{t('sample.emptyAction')}</Button>}
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
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Row>
      <IconButton icon={Pencil} label={t('sample.edit')} />
      <IconButton icon={Trash2} label={t('sample.remove')} />
    </Row>
  );
}

function InputSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Stack>
      <Input label={t('sample.studentName')} hint={t('sample.studentNameHint')} />
      <Input label={t('sample.studentName')} error={t('sample.studentNameError')} />
    </Stack>
  );
}

function KpiSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Kpi
      label={t('sample.attendanceToday')}
      value={SAMPLE_KPI_VALUE}
      delta={t('sample.attendanceDelta')}
      icon={CalendarCheck}
      tone="good"
    />
  );
}

function CelebrateButton() {
  const { t } = useTranslation(DESIGN_NS);
  const { burst } = usePetalBurst();
  return (
    <Button
      variant="secondary"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect();
        burst({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
      }}
    >
      {t('sample.celebrate')}
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
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Row>
      <Pill tone="good">{t('sample.paid')}</Pill>
      <Pill tone="warn">{t('sample.dueSoon')}</Pill>
      <Pill tone="bad">{t('sample.overdue')}</Pill>
      <Pill tone="brand">{t('sample.students')}</Pill>
    </Row>
  );
}

function SegmentedSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [value, setValue] = useState('present');
  return (
    <Segmented
      label={t('sample.attendance')}
      value={value}
      onChange={setValue}
      options={[
        { value: 'present', label: t('sample.present'), tone: 'good' },
        { value: 'late', label: t('sample.late'), tone: 'warn' },
        { value: 'absent', label: t('sample.absent'), tone: 'bad' },
      ]}
    />
  );
}

function SelectSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [value, setValue] = useState<string>(SAMPLE_CLASSES[1]);
  return (
    <Select
      label={t('sample.class')}
      value={value}
      onValueChange={setValue}
      options={SAMPLE_CLASSES.map((c) => ({ value: c, label: c }))}
    />
  );
}

function SparklineSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Sparkline
      values={SAMPLE_TREND}
      trend="up"
      label={t('sample.attendanceTrend')}
      className="h-10 w-40"
    />
  );
}

function SwitchSample() {
  const { t } = useTranslation(DESIGN_NS);
  return <Switch label={t('sample.feeReminders')} defaultChecked />;
}

function TableSample() {
  const { t } = useTranslation(DESIGN_NS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const columns: TableColumn<SampleStudent>[] = [
    {
      key: 'name',
      header: t('sample.name'),
      sortable: true,
      sortValue: (s) => s.name,
      cell: (s) => (
        <span className="flex items-center gap-2.5 font-semibold">
          <Avatar name={s.name} size="sm" decorative />
          {s.name}
        </span>
      ),
    },
    { key: 'class', header: t('sample.class'), cell: (s) => s.className, hideBelow: 'sm' },
    {
      key: 'due',
      header: t('sample.feesDue'),
      align: 'right',
      sortable: true,
      sortValue: (s) => s.due.amountMinor,
      cell: (s) => formatMoney(s.due, LOCALE),
    },
  ];
  return (
    <Table
      caption={t('sample.students')}
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
  const { t } = useTranslation(DESIGN_NS);
  const tabs = [
    { value: 'overview', label: t('sample.overview') },
    { value: 'fees', label: t('sample.fees'), count: 2 },
    { value: 'attendance', label: t('sample.attendance') },
  ];
  return (
    <Tabs
      label={t('sample.students')}
      tabs={tabs.map((tab) => ({
        ...tab,
        panel: <p className="m-0 pt-3 text-ink-2">{t('sample.tabPanel', { tab: tab.label })}</p>,
      }))}
    />
  );
}

function TextareaSample() {
  const { t } = useTranslation(DESIGN_NS);
  return <Textarea label={t('sample.notes')} rows={3} />;
}

/** The page wraps everything in one `ToastProvider`, so there is a single "Notifications" region. */
function ToastButton() {
  const { t } = useTranslation(DESIGN_NS);
  const toast = useToast();
  return (
    <Button
      variant="secondary"
      onClick={() => {
        toast.show(t('sample.toast'));
      }}
    >
      {t('sample.showToast')}
    </Button>
  );
}

function TooltipSample() {
  const { t } = useTranslation(DESIGN_NS);
  return (
    <Tooltip content={t('sample.tooltip')}>
      <IconButton icon={Info} label={t('sample.moreInfo')} />
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

function FormatRelativeSample() {
  const now = new Date(SAMPLE_DATE);
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000);
  return (
    <Stack>
      {[0.5, 5, 30, 24 * 9].map((hours) => (
        <Result
          key={hours}
          input={`formatRelative(${String(hours)} hours before now, now, '${SAMPLE_TIME_ZONE}')`}
          output={formatRelative(hoursAgo(hours), now, SAMPLE_TIME_ZONE)}
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
  { name: 'ActionMenu', Sample: ActionMenuSample },
  { name: 'Avatar', Sample: AvatarSample },
  { name: 'Button', Sample: ButtonSample },
  { name: 'buttonVariants', Sample: ButtonVariantsSample },
  { name: 'Card', Sample: CardSample },
  { name: 'Checkbox', Sample: CheckboxSample },
  { name: 'Chip', Sample: ChipSample },
  { name: 'DropdownFilter', Sample: DropdownFilterSample },
  { name: 'CommandPalette', Sample: CommandPaletteSample },
  { name: 'Drawer', Sample: DrawerSample },
  { name: 'DrawerClose', Sample: DrawerSample },
  { name: 'Stepper', Sample: StepperSample },
  { name: 'EmptyState', Sample: EmptyStateSample },
  { name: 'GreetingScene', Sample: GreetingSceneSample },
  { name: 'IconButton', Sample: IconButtonSample },
  { name: 'Input', Sample: InputSample },
  { name: 'Kpi', Sample: KpiSample },
  { name: 'PetalBurstProvider', Sample: PetalBurstSample },
  { name: 'usePetalBurst', Sample: PetalBurstSample },
  { name: 'OtpBoxes', Sample: OtpBoxesSample },
  { name: 'PermissionMatrix', Sample: PermissionMatrixSample },
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
  { name: 'useLeaveGuard', Sample: LeaveGuardSample },
  { name: 'formatDate', Sample: FormatDateSample },
  { name: 'formatMoney', Sample: FormatMoneySample },
  { name: 'formatRelative', Sample: FormatRelativeSample },
];
