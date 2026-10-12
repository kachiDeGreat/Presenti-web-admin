import React, { useState, useMemo } from 'react';
import {
  Printer,
  Download,
  Calendar,
  Filter,
} from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import { getStoredMembers, getStoredAttendance } from '../services/dataService';
import styles from './ReportsPage.module.css';

export const ReportsPage: React.FC = () => {
  const { church } = useAuth();

  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedDept, setSelectedDept] = useState<string>(
    church?.departments?.[0] || 'Choir & Music'
  );

  const members = useMemo(() => getStoredMembers(), []);
  const attendanceRecords = useMemo(() => getStoredAttendance(), []);

  // Compute all scheduled service dates in the chosen month & year based on church.policySettings.serviceDays
  const serviceDatesInMonth = useMemo(() => {
    const activeDays = church?.policySettings?.serviceDays || [0, 3]; // Default: Sunday (0) & Wednesday (3)
    const dates: { dateStr: string; dayName: string; dayNum: number }[] = [];
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth, day);
      if (activeDays.includes(d.getDay())) {
        const yyyy = selectedYear;
        const mm = String(selectedMonth + 1).padStart(2, '0');
        const dd = String(day).padStart(2, '0');
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dates.push({
          dateStr: `${yyyy}-${mm}-${dd}`,
          dayName: dayNames[d.getDay()],
          dayNum: day,
        });
      }
    }
    return dates;
  }, [selectedYear, selectedMonth, church?.policySettings?.serviceDays]);

  // Filter members by selected department
  const departmentMembers = useMemo(() => {
    if (!selectedDept || selectedDept === 'ALL') return members;
    return members.filter((m) => m.department === selectedDept);
  }, [members, selectedDept]);

  // Lookup record by member and service date
  const getRecord = (memberId: string, dateStr: string) => {
    return attendanceRecords.find(
      (a) => a.memberId === memberId && a.serviceDate === dateStr
    );
  };

  // Compute percentage attendance
  const computeMemberRate = (memberId: string) => {
    if (serviceDatesInMonth.length === 0) return { attended: 0, total: 0, percent: 0 };
    const attended = serviceDatesInMonth.filter((sd) => getRecord(memberId, sd.dateStr)).length;
    const total = serviceDatesInMonth.length;
    const percent = Math.round((attended / total) * 100);
    return { attended, total, percent };
  };

  // CSV Exporter
  const handleExportCSV = () => {
    const headers = [
      'Member Name',
      'Phone',
      'Department',
      ...serviceDatesInMonth.map((sd) => `${sd.dayName} ${sd.dateStr}`),
      'Total Attended',
      'Total Services',
      'Attendance Rate (%)',
    ];

    const rows = departmentMembers.map((member) => {
      const stats = computeMemberRate(member.id);
      const dayValues = serviceDatesInMonth.map((sd) => {
        const record = getRecord(member.id, sd.dateStr);
        if (!record) return 'ABSENT';
        const time = new Date(record.punchedAt).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });
        return time;
      });

      return [
        `"${member.fullName}"`,
        `"${member.phone}"`,
        `"${member.department}"`,
        ...dayValues,
        stats.attended,
        stats.total,
        `${stats.percent}%`,
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
    link.setAttribute('download', `Attendance_${selectedDept}_${monthName}_${selectedYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${selectedDept} attendance matrix (${monthName} ${selectedYear}).`);
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
          <h1>Monthly Audit Matrix & Export Engine</h1>
          <p className={styles.headerSubtitle}>
            Cross-service attendance matrix for departmental reviews, leadership meetings, and workforce compliance audits.
          </p>
        </div>

        <div className={`${styles.headerControls} no-print`}>
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

      {/* Filter Selector Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <Calendar size={16} color="var(--text-muted)" />
          <span className={styles.filterLabel}>Month / Year:</span>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
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
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className={styles.filterSelect}
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
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
            {church?.departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Print-Only Header Banner for Landscape A4 */}
      <div className={styles.printHeader}>
        <div className={styles.printTitle}>
          {church?.churchName} — {church?.branchName}
        </div>
        <div className={styles.printMeta}>
          <span><strong>Audit Period:</strong> {monthLabel}</span>
          <span><strong>Department:</strong> {selectedDept}</span>
          <span><strong>Organization Code:</strong> {church?.churchCode}</span>
          <span><strong>Generated:</strong> {new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Audit Matrix Grid */}
      <div className={styles.matrixWrapper}>
        <table className={styles.matrixTable}>
          <thead>
            <tr>
              <th className={styles.memberCol}>Staff / Member Name</th>
              {serviceDatesInMonth.map((sd) => (
                <th key={sd.dateStr} className={styles.serviceDayCol}>
                  <div>{sd.dayName}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {sd.dayNum}
                  </div>
                </th>
              ))}
              <th className={styles.rateCol}>Attendance Rate</th>
            </tr>
          </thead>
          <tbody>
            {departmentMembers.length === 0 ? (
              <tr>
                <td colSpan={serviceDatesInMonth.length + 2} style={{ padding: 32, color: 'var(--text-muted)' }}>
                  No registered members found for this department.
                </td>
              </tr>
            ) : (
              departmentMembers.map((member) => {
                const stats = computeMemberRate(member.id);

                return (
                  <tr key={member.id}>
                    <td className={styles.memberCol}>
                      <div style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                        {member.fullName}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {member.department}
                      </div>
                    </td>

                    {serviceDatesInMonth.map((sd) => {
                      const record = getRecord(member.id, sd.dateStr);

                      if (!record) {
                        return (
                          <td key={sd.dateStr}>
                            <span className={styles.cellAbsent}>ABSENT</span>
                          </td>
                        );
                      }

                      const timeStr = new Date(record.punchedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      return (
                        <td key={sd.dateStr}>
                          <div className={styles.cellPresent}>
                            <span className={styles.cellTime}>{timeStr}</span>
                            <span
                              className="badge badge-success"
                              style={{ padding: '1px 5px', fontSize: '0.65rem' }}
                            >
                              VERIFIED
                            </span>
                          </div>
                        </td>
                      );
                    })}

                    <td className={styles.rateCol}>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                        {stats.percent}%
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {stats.attended}/{stats.total} services
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
        <div className={styles.legendItem}>
          <span className="badge badge-success">VERIFIED</span>
          <span>Verified on-premise within active sign-in window</span>
        </div>
        <div className={styles.legendItem}>
          <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>ABSENT</span>
          <span>No on-premise hardware radio or geofence verification recorded</span>
        </div>
      </div>
    </div>
  );
};
