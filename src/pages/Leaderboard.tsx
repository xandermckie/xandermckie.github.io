import { useMemo, useState } from 'react';
import RankBadge from '../components/RankBadge';
import { useSession } from '../context/SessionContext';
import { useLanguage } from '../context/LanguageContext';
import { getAggregateStats } from '../lib/progress';
import { getRaceRankState, getRankForWpm, rankSortValue } from '../lib/race-rank';
import { getRaceRecords } from '../lib/race-stats';

type OverallSortKey = 'rank' | 'avgWpm' | 'avgAccuracy' | 'completed';
type RecordSortKey = 'finishMs' | 'wpm' | 'exerciseTitle';
type Tab = 'overall' | 'records';

export default function Leaderboard() {
  const { accounts, scopeId } = useSession();
  const { kit } = useLanguage();
  const [tab, setTab] = useState<Tab>('overall');
  const [overallSort, setOverallSort] = useState<OverallSortKey>('rank');
  const [recordSort, setRecordSort] = useState<RecordSortKey>('finishMs');

  const raceRecords = useMemo(() => getRaceRecords(accounts, kit.exercises), [accounts, kit.exercises]);

  const overallRows = useMemo(() => {
    return accounts
      .map((a) => {
        const stats = getAggregateStats(a.id);
        const rankState = getRaceRankState(a.id);
        return {
          ...stats,
          username: a.username,
          id: a.id,
          peakRaceWpm: rankState.peakRaceWpm,
        };
      })
      .sort((a, b) => {
        if (overallSort === 'rank') {
          const diff =
            rankSortValue(getRankForWpm(b.peakRaceWpm)) - rankSortValue(getRankForWpm(a.peakRaceWpm));
          if (diff !== 0) return diff;
          return b.peakRaceWpm - a.peakRaceWpm;
        }
        return b[overallSort] - a[overallSort];
      });
  }, [accounts, overallSort]);

  const sortedRecords = useMemo(() => {
    return [...raceRecords].sort((a, b) => {
      if (recordSort === 'exerciseTitle') return a.exerciseTitle.localeCompare(b.exerciseTitle);
      return a[recordSort] - b[recordSort];
    });
  }, [raceRecords, recordSort]);

  if (!accounts.length) {
    return (
      <div className="mx-auto max-w-2xl py-16 text-center">
        <p className="text-sm text-content-secondary">
          No accounts yet. Create an account to appear on the leaderboard.
        </p>
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      active ? 'bg-[var(--color-accent-subtle)] text-accent' : 'text-content-secondary hover:bg-background-secondary'
    }`;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-content-primary">Leaderboard</h1>
        <p className="mt-1 text-sm text-content-secondary">
          Progress stats and race records for local accounts on this device.
        </p>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setTab('overall')} className={tabClass(tab === 'overall')}>
          Overall
        </button>
        <button type="button" onClick={() => setTab('records')} className={tabClass(tab === 'records')}>
          Race records
        </button>
      </div>

      {tab === 'overall' ? (
        <div className="overflow-x-auto rounded-lg border border-border-tertiary bg-background-secondary">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-border-tertiary">
                <th className="w-10 px-4 py-2.5 text-left font-medium text-content-tertiary">#</th>
                <th className="px-4 py-2.5 text-left font-medium text-content-tertiary">User</th>
                <th className="px-4 py-2.5 text-right">
                  <SortHeader label="Rank" active={overallSort === 'rank'} onClick={() => setOverallSort('rank')} />
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortHeader label="Avg WPM" active={overallSort === 'avgWpm'} onClick={() => setOverallSort('avgWpm')} />
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortHeader
                    label="Avg Acc"
                    active={overallSort === 'avgAccuracy'}
                    onClick={() => setOverallSort('avgAccuracy')}
                  />
                </th>
                <th className="px-4 py-2.5 text-right">
                  <SortHeader
                    label="Exercises"
                    active={overallSort === 'completed'}
                    onClick={() => setOverallSort('completed')}
                  />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-tertiary">
              {overallRows.map((row, i) => {
                const isYou = row.id === scopeId;
                return (
                  <tr key={row.id} className={isYou ? 'bg-background-tertiary' : ''}>
                    <td className="px-4 py-3 tabular-nums text-content-tertiary">{i + 1}</td>
                    <td className="px-4 py-3 font-medium text-content-primary">
                      {row.username}
                      {isYou && <span className="ml-2 text-xs text-accent">you</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <RankBadge wpm={row.peakRaceWpm} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-content-primary">{row.avgWpm || '-'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-content-primary">
                      {row.avgAccuracy ? `${row.avgAccuracy}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-content-secondary">{row.completed}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-tertiary bg-background-secondary">
          {sortedRecords.length === 0 ? (
            <p className="p-6 text-sm text-content-secondary">No race records yet. Complete a race to appear here.</p>
          ) : (
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border-tertiary">
                  <th className="px-4 py-2.5 text-left font-medium text-content-tertiary">User</th>
                  <th className="px-4 py-2.5 text-left">
                    <SortHeader
                      label="Exercise"
                      active={recordSort === 'exerciseTitle'}
                      onClick={() => setRecordSort('exerciseTitle')}
                    />
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <SortHeader label="Time" active={recordSort === 'finishMs'} onClick={() => setRecordSort('finishMs')} />
                  </th>
                  <th className="px-4 py-2.5 text-right">
                    <SortHeader label="WPM" active={recordSort === 'wpm'} onClick={() => setRecordSort('wpm')} />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-tertiary">
                {sortedRecords.map((row) => {
                  const isYou = row.profileId === scopeId;
                  return (
                    <tr key={`${row.profileId}:${row.exerciseId}`} className={isYou ? 'bg-background-tertiary' : ''}>
                      <td className="px-4 py-3 font-medium text-content-primary">
                        {row.username}
                        {isYou && <span className="ml-2 text-xs text-accent">you</span>}
                      </td>
                      <td className="px-4 py-3 text-content-secondary">{row.exerciseTitle}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-content-primary">
                        {(row.finishMs / 1000).toFixed(1)}s
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-content-primary">{row.wpm}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      <p className="text-xs text-content-tertiary">Click a column header to re-sort. Guest progress is not included.</p>
    </div>
  );
}

function SortHeader({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`font-medium transition-colors ${active ? 'text-accent' : 'text-content-tertiary hover:text-content-secondary'}`}
    >
      {label}
    </button>
  );
}
