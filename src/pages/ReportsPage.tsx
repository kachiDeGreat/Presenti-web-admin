import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Printer,
  Download,
  Calendar,
  Filter,
  Search,
  CheckCircle2,
  Users,
  Activity,
  Radio,
  FileSpreadsheet,
  ShieldCheck,
  PlusCircle,
  X,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToAttendance,
  subscribeToMembers,
  getStoredMembers,
  getStoredAttendance,
  saveStoredAttendance,
} from '../services/dataService';
import type { AttendanceRecord, ChurchMember, VerificationMethod } from '../types';
import styles from './ReportsPage.module.css';

// Manual Log Modal interface
interface ManualLogForm {
  memberId: string;
  serviceDate: string;
  punchedAt: string;
  verificationMethod: VerificationMethod;
}

export const ReportsPage: React.FC = () => {
  const { church } = useAuth();

  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth()); // 0-11
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Manual Log Modal state
  const [showManualLog, setShowManualLog] = useState(false);
  const [manualForm, setManualForm] = useState<ManualLogForm>({
    memberId: '',
    serviceDate: now.toISOString().split('T')[0],
    punchedAt: `${now.toISOString().split('T')[0]}T08:00`,
    verificationMethod: 'WIFI_BSSID',
  });
  const [isSaving, setIsSaving] = useState(false);

  const [members, setMembers] = useState<ChurchMember[]>(() => getStoredMembers());
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>(() =>
    getStoredAttendance()
  );

  // Real-time Firestore synchronization for attendance punches
  useEffect(() => {
    setIsLoading(true);
    if (!church?.id) {
      setIsLoading(false);
      return;
    }
    let membersLoaded = false;
    let attendanceLoaded = false;
    const checkDone = () => {
      if (membersLoaded && attendanceLoaded) {
        setIsLoading(false);
        setLastSyncedAt(new Date());
      }
    };

    const unsubAttendance = subscribeToAttendance(church.id, (records) => {
      setAttendanceRecords(records);
      attendanceLoaded = true;
      setLastSyncedAt(new Date());
      checkDone();
    });
    const unsubMembers = subscribeToMembers(church.id, (list) => {
      setMembers(list);
      membersLoaded = true;
      checkDone();
    });

    return () => {
      unsubAttendance();
      unsubMembers();
    };
  }, [church?.id]);

  // Available year choices
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    return [currentYear - 1, currentYear, currentYear + 1];
  }, []);

  // Compute all scheduled and actual attendance dates in the chosen month & year
  const serviceDatesInMonth = useMemo(() => {
    const activeDays = church?.policySettings?.serviceDays || [1, 2, 3, 4, 5];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const datesMap = new Map<string, { dateStr: string; dayName: string; dayNum: number; isScheduled: boolean }>();

    // 1. Add all days configured in organization policy
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth, day);
      if (activeDays.includes(d.getDay())) {
        const yyyy = selectedYear;
        const mm = String(selectedMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;
        datesMap.set(dateStr, {
          dateStr,
          dayName: dayNames[d.getDay()],
          dayNum: day,
          isScheduled: true,
        });
      }
    }

    // 2. Also ensure any day with actual recorded check-ins is included
    const targetMonthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    for (const rec of attendanceRecords) {
      const recDate = rec.serviceDate || rec.punchedAt?.split('T')[0];
      if (recDate && recDate.startsWith(targetMonthPrefix) && !datesMap.has(recDate)) {
        try {
          const parts = recDate.split('-');
          const dayNum = parseInt(parts[2], 10);
          const d = new Date(selectedYear, selectedMonth, dayNum);
          datesMap.set(recDate, {
            dateStr: recDate,
            dayName: dayNames[d.getDay()],
            dayNum,
            isScheduled: false,
          });
        } catch {
          // ignore date parse issue
        }
      }
    }

    // Sort chronologically
    return Array.from(datesMap.values()).sort((a, b) => a.dayNum - b.dayNum);
  }, [selectedYear, selectedMonth, church?.policySettings?.serviceDays, attendanceRecords]);

  // Synthesize complete roster (registered members + any attendees from attendance stream)
  const combinedRoster = useMemo(() => {
    const rosterMap = new Map<string, ChurchMember>();

    for (const m of members) {
      rosterMap.set(m.id, m);
    }

    // Ensure any user who logged attendance is present in roster
    for (const a of attendanceRecords) {
      if (!rosterMap.has(a.memberId)) {
        rosterMap.set(a.memberId, {
          id: a.memberId,
          fullName: a.memberName || 'Unknown Member',
          phone: '—',
          department: a.department || 'General Workforce',
          boundDeviceId: 'AUTO_BOUND',
          registeredAt: a.punchedAt,
        });
      }
    }

    return Array.from(rosterMap.values());
  }, [members, attendanceRecords]);

  // Filter members by department and search query
  const filteredMembers = useMemo(() => {
    return combinedRoster.filter((m) => {
      const matchDept = selectedDept === 'ALL' || m.department === selectedDept;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        (m.phone && m.phone.toLowerCase().includes(q)) ||
        (m.department && m.department.toLowerCase().includes(q));
      return matchDept && matchSearch;
    });
  }, [combinedRoster, selectedDept, searchQuery]);

  // Lookup attendance record by member and service date
  const getRecord = (memberId: string, memberName: string, dateStr: string) => {
    return attendanceRecords.find((a) => {
      const matchMember =
        a.memberId === memberId ||
        (a.memberName && a.memberName.trim().toLowerCase() === memberName.trim().toLowerCase());
      const recDate = a.serviceDate || a.punchedAt?.split('T')[0];
      const matchDate = recDate === dateStr;
      return matchMember && matchDate;
    });
  };

  // Compute percentage attendance
  const computeMemberRate = (memberId: string, memberName: string) => {
    if (serviceDatesInMonth.length === 0) return { attended: 0, total: 0, percent: 0 };
    const attended = serviceDatesInMonth.filter((sd) => getRecord(memberId, memberName, sd.dateStr)).length;
    const total = serviceDatesInMonth.length;
    const percent = Math.round((attended / total) * 100);
    return { attended, total, percent };
  };

  // Monthly summary stats for selected view
  const monthStats = useMemo(() => {
    const targetMonthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const monthlyRecords = attendanceRecords.filter((a) => {
      const recDate = a.serviceDate || a.punchedAt?.split('T')[0];
      const matchDate = recDate && recDate.startsWith(targetMonthPrefix);
      const matchDept = selectedDept === 'ALL' || a.department === selectedDept;
      return matchDate && matchDept;
    });

    const totalCheckins = monthlyRecords.length;
    const totalPossible = filteredMembers.length * (serviceDatesInMonth.length || 1);
    const overallRate = totalPossible > 0 ? Math.min(100, Math.round((totalCheckins / totalPossible) * 100)) : 0;

    return {
      totalCheckins,
      totalWorkers: filteredMembers.length,
      scheduledDays: serviceDatesInMonth.length,
      overallRate,
    };
  }, [attendanceRecords, selectedYear, selectedMonth, selectedDept, filteredMembers, serviceDatesInMonth]);

  // ── Manual Log Handler ──────────────────────────────────────────────────
  const handleManualLog = useCallback(async () => {
    if (!manualForm.memberId || !manualForm.serviceDate || !manualForm.punchedAt) {
      toast.error('Please fill in all required fields.');
      return;
    }

    const member = combinedRoster.find((m) => m.id === manualForm.memberId);
    if (!member) {
      toast.error('Selected member not found.');
      return;
    }

    // Prevent duplicate entry for same member + date
    const existing = attendanceRecords.find((a) => {
      const matchMember = a.memberId === member.id;
      const recDate = a.serviceDate || a.punchedAt?.split('T')[0];
      return matchMember && recDate === manualForm.serviceDate;
    });
    if (existing) {
      toast.warn(
        `${member.fullName} already has an attendance record for ${manualForm.serviceDate}. Remove it first to re-log.`
      );
      return;
    }

    setIsSaving(true);
    try {
      const punchedAtISO = new Date(manualForm.punchedAt).toISOString();
      const newRecord: AttendanceRecord = {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        memberId: member.id,
        memberName: member.fullName,
        department: member.department,
        serviceDate: manualForm.serviceDate,
        punchedAt: punchedAtISO,
        syncedAt: new Date().toISOString(),
        verificationMethod: manualForm.verificationMethod,
        status: 'ON_TIME',
      };

      // Persist locally & to cloud if Firebase is live
      const updatedRecords = [newRecord, ...attendanceRecords];
      setAttendanceRecords(updatedRecords);
      saveStoredAttendance(updatedRecords);

      // If Firebase is configured, also write to Firestore
      if (church?.id) {
        try {
          const { collection, addDoc } = await import('firebase/firestore');
          const { db, isFirebaseConfigured } = await import('../config/firebase');
          if (isFirebaseConfigured && db) {
            const attCollection = collection(db, 'churches', church.id, 'attendance');
            await addDoc(attCollection, {
              memberId: newRecord.memberId,
              memberName: newRecord.memberName,
              department: newRecord.department,
              serviceDate: newRecord.serviceDate,
              punchedAt: newRecord.punchedAt,
              syncedAt: newRecord.syncedAt,
              verificationMethod: newRecord.verificationMethod,
              status: newRecord.status,
            });
          }
        } catch (fbErr) {
          console.warn('Could not sync manual log to Firestore (saved locally):', fbErr);
        }
      }

      toast.success(
        `Attendance manually logged for ${member.fullName} on ${manualForm.serviceDate}.`
      );
      setShowManualLog(false);
      // Reset form
      setManualForm({
        memberId: '',
        serviceDate: new Date().toISOString().split('T')[0],
        punchedAt: `${new Date().toISOString().split('T')[0]}T08:00`,
        verificationMethod: 'WIFI_BSSID',
      });
    } catch (err) {
      console.error('Manual log error:', err);
      toast.error('Failed to save attendance record. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [manualForm, combinedRoster, attendanceRecords, church?.id]);

  // CSV Exporter
  const handleExportCSV = () => {
    if (filteredMembers.length === 0) {
      toast.warn('No roster data available to export for this view.');
      return;
    }

    const headers = [
      'Staff Name',
      'Department',
      'Phone',
      ...serviceDatesInMonth.map((sd) => `"${sd.dayName} (${sd.dateStr})"`),
      'Total Attended',
      'Total Sessions',
      'Compliance Rate (%)',
    ];

    const rows = filteredMembers.map((member) => {
      const stats = computeMemberRate(member.id, member.fullName);
      const dayValues = serviceDatesInMonth.map((sd) => {
        const record = getRecord(member.id, member.fullName, sd.dateStr);
        if (!record) return '"ABSENT"';
        const time = new Date(record.punchedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        const method = record.verificationMethod === 'GEO_FALLBACK' ? 'GPS' : 'Wi-Fi';
        return `"${time} (${method})"`;
      });

      return [
        `"${member.fullName}"`,
        `"${member.department}"`,
        `"${member.phone}"`,
        ...dayValues,
        stats.attended,
        stats.total,
        `"${stats.percent}%"`,
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', {
      month: 'short',
    });
    const safeDept = selectedDept.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('download', `Audit_Matrix_${safeDept}_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filteredMembers.length} records for ${monthName} ${selectedYear}.`);
  };

  const handlePrint = () => {
    window.print();
  };

  const monthLabel = new Date(selectedYear, selectedMonth, 1).toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={styles.reportsContainer}>
      {/* Header & Export Actions */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleWrapper}>
          <div className={styles.titleBadgeRow}>
            <h1>Monthly Audit Matrix & Export Engine</h1>
            <span className={styles.liveSyncBadge} title="Connected to cloud Firestore">
              <span className={styles.pulseDot} />
              Live Cloud Sync
            </span>
          </div>
          <p className={styles.headerSubtitle}>
            Cross-service attendance matrix for departmental reviews, leadership meetings, and workforce compliance audits.
            {lastSyncedAt && (
              <span className={styles.lastSyncText}>
                {' '}· Last synced {lastSyncedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>

        <div className={`${styles.headerControls} no-print`}>
          <button
            type="button"
            onClick={() => setShowManualLog(true)}
            className="btn btn-secondary"
            title="Manually log attendance for a staff member"
          >
            <PlusCircle size={16} />
            <span>Manual Log</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary"
            title="Download CSV spreadsheet"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="btn btn-primary"
            title="Print-ready Landscape A4 format"
          >
            <Printer size={16} />
            <span>Print Audit Sheet (A4)</span>
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className={`${styles.statsGrid} no-print`}>
        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ backgroundColor: '#EFF6FF', color: '#2563EB' }}>
            <Users size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Roster Workforce</span>
            <span className={styles.statValue}>{monthStats.totalWorkers}</span>
            <span className={styles.statMeta}>{selectedDept === 'ALL' ? 'All Units' : selectedDept}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ backgroundColor: '#ECFDF5', color: '#059669' }}>
            <CheckCircle2 size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Verified Check-ins</span>
            <span className={styles.statValue}>{monthStats.totalCheckins}</span>
            <span className={styles.statMeta}>Logged in {monthLabel}</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ backgroundColor: '#F5F3FF', color: '#7C3AED' }}>
            <Calendar size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Operating Sessions</span>
            <span className={styles.statValue}>{monthStats.scheduledDays}</span>
            <span className={styles.statMeta}>Scheduled days in month</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIconWrapper} style={{ backgroundColor: '#FFFBEB', color: '#D97706' }}>
            <Activity size={20} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statLabel}>Monthly Compliance</span>
            <span className={styles.statValue}>{monthStats.overallRate}%</span>
            <span className={styles.statMeta}>Average attendance rate</span>
          </div>
        </div>
      </div>

      {/* Filter Selector Bar */}
      <div className={`${styles.filterBar} no-print`}>
        <div className={styles.filterGroup}>
          <Calendar size={16} color="var(--text-muted)" />
          <span className={styles.filterLabel}>Period:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            className={styles.filterSelect}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i} value={i}>
                {new Date(2026, i, 1).toLocaleString('en-US', { month: 'long' })}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            className={styles.filterSelect}
          >
            {yearOptions.map((yr) => (
              <option key={yr} value={yr}>
                {yr}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <Filter size={16} color="var(--text-muted)" />
          <span className={styles.filterLabel}>Department:</span>
          <select
            value={selectedDept}
            onChange={(e) => setSelectedDept(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="ALL">All Departments</option>
            {church?.departments?.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterSearchGroup}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search staff by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Print-Only Header Banner for Landscape A4 */}
      <div className={styles.printHeader}>
        <div className={styles.printTitle}>
          {church?.churchName} — {church?.branchName}
        </div>
        <div className={styles.printMeta}>
          <span><strong>Audit Period:</strong> {monthLabel}</span>
          <span><strong>Department:</strong> {selectedDept === 'ALL' ? 'All Departments' : selectedDept}</span>
          <span><strong>Organization Code:</strong> {church?.churchCode}</span>
          <span><strong>Arrival Cutoff:</strong> {church?.policySettings?.arrivalCutoff || 'Strict'}</span>
          <span><strong>Generated:</strong> {new Date().toLocaleString()}</span>
        </div>
      </div>

      {/* Audit Matrix Grid */}
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.memberCol}>
                <div className={styles.memberColHeader}>Staff / Member Name</div>
              </th>
              {serviceDatesInMonth.map((sd) => (
                <th
                  key={sd.dateStr}
                  className={`${styles.serviceDayCol} ${sd.isScheduled ? styles.scheduledDayHeader : ''}`}
                  title={`${sd.dayName}, ${sd.dateStr}${sd.isScheduled ? ' (Scheduled Operational Session)' : ''}`}
                >
                  <div className={styles.dayNameLabel}>{sd.dayName}</div>
                  <div className={`${styles.dayNumBadge} ${sd.isScheduled ? styles.dayNumScheduled : ''}`}>
                    {sd.dayNum}
                  </div>
                </th>
              ))}
              <th className={styles.rateCol}>Attendance Rate</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              // Loading skeleton rows
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className={styles.matrixRow}>
                  <td className={styles.memberCol}>
                    <div className={styles.skeletonName} />
                    <div className={styles.skeletonDept} />
                  </td>
                  {serviceDatesInMonth.slice(0, 10).map((sd) => (
                    <td key={sd.dateStr} className={styles.matrixCellTd}><div className={styles.skeletonCell} /></td>
                  ))}
                  {serviceDatesInMonth.length === 0 && (
                    <>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className={styles.matrixCellTd}><div className={styles.skeletonCell} /></td>
                      ))}
                    </>
                  )}
                  <td className={styles.rateCol}><div className={styles.skeletonRate} /></td>
                </tr>
              ))
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={serviceDatesInMonth.length + 2} className={styles.emptyTableState}>
                  <div className={styles.emptyContainer}>
                    <FileSpreadsheet size={36} color="#94A3B8" />
                    <h4>No records found for this selection</h4>
                    <p>
                      When workers punch in on mobile during active operational hours for {monthLabel}, their verified timestamps and compliance statistics will populate here automatically. Use the <strong>Manual Log</strong> button above to add retroactive entries.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const stats = computeMemberRate(member.id, member.fullName);

                return (
                  <tr key={member.id} className={styles.matrixRow}>
                    <td className={styles.memberCol}>
                      <div className={styles.memberInfoWrapper}>
                        <div className={styles.memberNameText}>
                          {member.fullName}
                        </div>
                        <div className={styles.memberMetaRow}>
                          <span className={styles.memberDeptBadge}>{member.department}</span>
                          {member.phone && member.phone !== '—' && (
                            <span className={styles.memberPhoneText}>• {member.phone}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {serviceDatesInMonth.map((sd) => {
                      const record = getRecord(member.id, member.fullName, sd.dateStr);

                      if (!record) {
                        return (
                          <td key={sd.dateStr} className={styles.matrixCellTd}>
                            <div className={styles.cellAbsentWrapper} title="No verified check-in logged">
                              <span className={styles.cellAbsentDash}>—</span>
                            </div>
                          </td>
                        );
                      }

                      const timeStr = new Date(record.punchedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const isGeo = record.verificationMethod === 'GEO_FALLBACK';

                      const isLate = record.status === 'LATE';
                      const signOutStr =
                        record.signOutDisplayTime ||
                        (record.signedOutAt
                          ? new Date(record.signedOutAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : null);

                      return (
                        <td key={sd.dateStr} className={styles.matrixCellTd}>
                          <div
                            className={`${styles.cellPresentCard} ${isGeo ? styles.cellPresentGps : styles.cellPresentWifi}`}
                            style={isLate ? { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' } : undefined}
                            title={`Verified at ${timeStr} (${isLate ? 'LATE' : 'ON-TIME'})${signOutStr ? ` • Departed at ${signOutStr}` : ''} via ${isGeo ? 'Authorized Geofence Satellite Radius' : 'Premises Wi-Fi Hardware Anchor'}`}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                              <span className={styles.cellPresentTime} style={isLate ? { color: '#B45309' } : undefined}>
                                {timeStr}
                              </span>
                              {isLate && (
                                <span
                                  style={{
                                    fontSize: '0.625rem',
                                    fontWeight: 700,
                                    color: '#B45309',
                                    backgroundColor: '#FEF3C7',
                                    padding: '1px 3px',
                                    borderRadius: 3,
                                  }}
                                >
                                  LATE
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                              <span className={isGeo ? styles.methodTagGps : styles.methodTagWifi}>
                                {isGeo ? <Radio size={10} /> : <ShieldCheck size={10} />}
                                <span>{isGeo ? 'GPS' : 'WI-FI'}</span>
                              </span>
                              {signOutStr && (
                                <span
                                  style={{
                                    fontSize: '0.625rem',
                                    fontWeight: 600,
                                    color: '#2563EB',
                                  }}
                                  title={`Sign-out: ${signOutStr}`}
                                >
                                  Out {signOutStr}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}

                    <td className={styles.rateCol}>
                      <div className={styles.rateColWrapper}>
                        <div className={styles.rateTopRow}>
                          <span
                            className={styles.rateBadge}
                            style={{
                              color:
                                stats.percent >= 75
                                  ? '#059669'
                                  : stats.percent >= 50
                                  ? '#D97706'
                                  : '#DC2626',
                              backgroundColor:
                                stats.percent >= 75
                                  ? '#ECFDF5'
                                  : stats.percent >= 50
                                  ? '#FFFBEB'
                                  : '#FEF2F2',
                              borderColor:
                                stats.percent >= 75
                                  ? '#A7F3D0'
                                  : stats.percent >= 50
                                  ? '#FDE68A'
                                  : '#FECACA',
                            }}
                          >
                            {stats.percent}%
                          </span>
                          <span className={styles.rateCountText}>
                            {stats.attended}/{stats.total}
                          </span>
                        </div>
                        <div className={styles.progressBarTrack}>
                          <div
                            className={styles.progressBarFill}
                            style={{
                              width: `${stats.percent}%`,
                              backgroundColor:
                                stats.percent >= 75
                                  ? '#10B981'
                                  : stats.percent >= 50
                                  ? '#F59E0B'
                                  : '#EF4444',
                            }}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Legend & Verification Summary */}
      <div className={`${styles.legendBar} no-print`}>
        <div className={styles.legendLeftSection}>
          <span className={styles.legendTitle}>Verification Key</span>
        </div>
        <div className={styles.legendItemsGrid}>
          <div className={styles.legendItemCard}>
            <span className={styles.methodTagWifi}>
              <ShieldCheck size={12} />
              <span>WI-FI</span>
            </span>
            <span className={styles.legendDesc}>
              Verified via Premises Wi-Fi BSSID Hardware Anchor
            </span>
          </div>

          <div className={styles.legendItemCard}>
            <span className={styles.methodTagGps}>
              <Radio size={12} />
              <span>GPS</span>
            </span>
            <span className={styles.legendDesc}>
              Verified via Authorized Geofence Satellite Radius
            </span>
          </div>

          <div className={styles.legendItemCard}>
            <span className={styles.methodTagAbsent}>
              <span>—</span>
              <span>ABSENT</span>
            </span>
            <span className={styles.legendDesc}>
              No on-premise verification logged during operational window
            </span>
          </div>
        </div>
      </div>

      {/* ── Manual Log Modal ──────────────────────────────────────────────── */}
      {showManualLog && (
        <div className={styles.modalOverlay} onClick={() => setShowManualLog(false)}>
          <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitleRow}>
                <PlusCircle size={20} color="var(--brand-primary)" />
                <h2 className={styles.modalTitle}>Manual Attendance Log</h2>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setShowManualLog(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalAlert}>
              <AlertCircle size={14} />
              <span>Use this only for retroactive entries. Mobile app sign-ins are logged automatically.</span>
            </div>

            <div className={styles.modalBody}>
              <label className={styles.fieldLabel}>Staff Member *</label>
              <select
                className={styles.fieldSelect}
                value={manualForm.memberId}
                onChange={(e) => setManualForm((f) => ({ ...f, memberId: e.target.value }))}
              >
                <option value="">— Select a member —</option>
                {combinedRoster
                  .slice()
                  .sort((a, b) => a.fullName.localeCompare(b.fullName))
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.fullName} · {m.department}
                    </option>
                  ))}
              </select>

              <label className={styles.fieldLabel}>Service Date *</label>
              <input
                type="date"
                className={styles.fieldInput}
                value={manualForm.serviceDate}
                onChange={(e) =>
                  setManualForm((f) => ({
                    ...f,
                    serviceDate: e.target.value,
                    punchedAt: `${e.target.value}T${f.punchedAt.split('T')[1] || '08:00'}`,
                  }))
                }
              />

              <label className={styles.fieldLabel}>Sign-In Time *</label>
              <input
                type="datetime-local"
                className={styles.fieldInput}
                value={manualForm.punchedAt}
                onChange={(e) => setManualForm((f) => ({ ...f, punchedAt: e.target.value }))}
              />

              <div>
                <label className={styles.fieldLabel}>Verification Method</label>
                <select
                  className={styles.fieldSelect}
                  value={manualForm.verificationMethod}
                  onChange={(e) =>
                    setManualForm((f) => ({
                      ...f,
                      verificationMethod: e.target.value as VerificationMethod,
                    }))
                  }
                >
                  <option value="WIFI_BSSID">Wi-Fi Hardware Anchor (BSSID)</option>
                  <option value="GEO_FALLBACK">GPS Geofence Satellite Radius</option>
                </select>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowManualLog(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleManualLog}
                disabled={isSaving || !manualForm.memberId}
              >
                {isSaving ? 'Saving...' : 'Save Attendance Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

