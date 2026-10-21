import React, { useState, useEffect, useMemo } from 'react';
import { Search } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';
import {
  subscribeToMembers,
  deleteMemberFromFirestore,
  unbindMemberDeviceInFirestore,
  getStoredAttendance,
} from '../services/dataService';
import { DeleteMemberModal } from '../components/common/DeleteMemberModal';
import type { ChurchMember } from '../types';
import styles from './MembersPage.module.css';

export const MembersPage: React.FC = () => {
  const { church } = useAuth();
  const [members, setMembers] = useState<ChurchMember[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [memberToDelete, setMemberToDelete] = useState<ChurchMember | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (!church?.id) return;
    const unsubscribe = subscribeToMembers(church.id, (list) => {
      setMembers(list);
    });
    return () => unsubscribe();
  }, [church?.id]);

  const handleCopyChurchCode = () => {
    if (church?.churchCode) {
      navigator.clipboard.writeText(church.churchCode);
      toast.success(`Copied Organization Code "${church.churchCode}" to clipboard.`);
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const matchDept = selectedDept === 'ALL' || m.department === selectedDept;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        m.fullName.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.email && m.email.toLowerCase().includes(q)) ||
        m.department.toLowerCase().includes(q) ||
        m.boundDeviceId.toLowerCase().includes(q);
      return matchDept && matchSearch;
    });
  }, [members, selectedDept, searchQuery]);

  const totalCount = members.length;
  const boundDevicesCount = members.filter(
    (m) => m.boundDeviceId && m.boundDeviceId !== 'UNBOUND'
  ).length;

  const todayCheckedInCount = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const records = getStoredAttendance().filter((a) => a.serviceDate === todayStr);
    const uniqueIds = new Set(records.map((r) => r.memberId));
    return uniqueIds.size;
  }, [members]);

  const allDepartments = useMemo(() => {
    if (church?.departments && church.departments.length > 0) {
      return church.departments;
    }
    const fromMembers = Array.from(new Set(members.map((m) => m.department))).filter(Boolean);
    return fromMembers.length > 0 ? fromMembers : ['General Workforce'];
  }, [church?.departments, members]);

  const handleOpenDeleteModal = (member: ChurchMember) => {
    setMemberToDelete(member);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (member: ChurchMember) => {
    if (!church?.id) return;
    try {
      await deleteMemberFromFirestore(church.id, member.id);
      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      toast.success(`Successfully deleted "${member.fullName}" from organization registry.`);
    } catch (err: any) {
      toast.error(err?.message || `Failed to delete "${member.fullName}" from database.`);
      throw err;
    }
  };

  const handleUnbindDevice = async (member: ChurchMember) => {
    if (!church?.id) return;
    if (
      window.confirm(
        `Reset hardware lock for "${member.fullName}"? Their next mobile sign-in will bind their new device.`
      )
    ) {
      try {
        await unbindMemberDeviceInFirestore(church.id, member.id);
        setMembers((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, boundDeviceId: 'UNBOUND' } : m))
        );
        toast.success(`Device lock reset for "${member.fullName}".`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to reset device lock in database.');
      }
    }
  };

  const handleExportCSV = () => {
    if (filteredMembers.length === 0) {
      toast.warn('No records to export.');
      return;
    }
    const headers = ['Full Name', 'Department', 'Phone', 'Email', 'Device ID', 'Registered Date'];
    const rows = filteredMembers.map((m) => [
      `"${m.fullName.replace(/"/g, '""')}"`,
      `"${m.department.replace(/"/g, '""')}"`,
      `"${m.phone}"`,
      `"${m.email || ''}"`,
      `"${m.boundDeviceId}"`,
      `"${new Date(m.registeredAt).toLocaleDateString()}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${(church?.churchCode || 'organization').toLowerCase()}-users.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Exported CSV directory.');
  };

  return (
    <div className={styles.pageContainer}>
      {/* Mature Executive Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleWrapper}>
          <div className="section-tag">// WORKFORCE REGISTRY & ROSTER</div>
          <h1 className={styles.headerTitle}>Organization Registered Users</h1>
          <p className={styles.headerSubtitle}>
            Enrolled workforce directory and mobile device hardware credentials for{' '}
            {church?.churchName || 'Your Organization'}.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            onClick={handleCopyChurchCode}
            className={styles.codeButton}
            title="Click to copy pairing code for mobile users"
          >
            <span>Pairing Code:</span>
            <code>{church?.churchCode || 'CODE'}</code>
          </button>
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn btn-secondary"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Clean KPI Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Enrolled</span>
          <span className={styles.metricValue}>{totalCount}</span>
          <span className={styles.metricHint}>Workforce members</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Units</span>
          <span className={styles.metricValue}>{allDepartments.length}</span>
          <span className={styles.metricHint}>Configured departments</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Hardware Locked</span>
          <span className={styles.metricValue}>{boundDevicesCount}</span>
          <span className={styles.metricHint}>1-Device anti-fraud binding</span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Clocked In Today</span>
          <span className={styles.metricValue}>{todayCheckedInCount}</span>
          <span className={styles.metricHint}>
            {totalCount > 0 ? `${Math.round((todayCheckedInCount / totalCount) * 100)}% attendance` : '0% attendance'}
          </span>
        </div>
      </div>

      {/* Department Filter Row */}
      <div className={styles.deptChipsScroll}>
        <button
          type="button"
          onClick={() => setSelectedDept('ALL')}
          className={`${styles.deptChip} ${selectedDept === 'ALL' ? styles.deptChipActive : ''}`}
        >
          <span>All Units</span>
          <span className={styles.deptChipBadge}>{members.length}</span>
        </button>
        {allDepartments.map((dept) => {
          const count = members.filter((m) => m.department === dept).length;
          return (
            <button
              key={dept}
              type="button"
              onClick={() => setSelectedDept(dept)}
              className={`${styles.deptChip} ${selectedDept === dept ? styles.deptChipActive : ''}`}
            >
              <span>{dept}</span>
              <span className={styles.deptChipBadge}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Clean Table Card */}
      <div className={styles.tableCard}>
        <div className={styles.toolbar}>
          <div className={styles.searchInputWrapper}>
            <Search size={15} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Filter by name, phone, email, or device ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.toolbarCount}>
            {filteredMembers.length} {filteredMembers.length === 1 ? 'user' : 'users'}
          </div>
        </div>

        <div className="data-table-container" style={{ border: 'none', borderRadius: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Department Unit</th>
                <th>Contact</th>
                <th>Device Binding</th>
                <th>Enrolled Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyTitle}>No users found</div>
                      <div className={styles.emptyDesc}>
                        {members.length === 0
                          ? `Personnel register directly via the mobile app using Organization Code "${church?.churchCode || 'CODE'}".`
                          : 'No registered personnel match the current filter criteria.'}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((member) => {
                  const isBound = member.boundDeviceId && member.boundDeviceId !== 'UNBOUND';

                  return (
                    <tr key={member.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {member.photoURL ? (
                            <img
                              src={member.photoURL}
                              alt=""
                              style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-subtle)' }}
                            />
                          ) : null}
                          <div className={styles.memberNameCol}>
                            <span className={styles.memberName}>{member.fullName}</span>
                            {member.email && <span className={styles.memberEmail}>{member.email}</span>}
                          </div>
                        </div>
                      </td>

                      <td>
                        <span style={{ fontSize: '0.825rem', color: 'var(--text-body)' }}>
                          {member.department}
                        </span>
                      </td>

                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem' }}>
                        {member.phone}
                      </td>

                      <td>
                        {isBound ? (
                          <span className={styles.deviceMono} title={`Device Hardware ID: ${member.boundDeviceId}`}>
                            {member.boundDeviceId.slice(0, 16)}...
                          </span>
                        ) : (
                          <span className={styles.deviceUnbound}>
                            Unpinned
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                        {new Date(member.registeredAt).toLocaleDateString([], {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>

                      <td>
                        <div className={styles.actionsCell}>
                          <button
                            type="button"
                            onClick={() => handleUnbindDevice(member)}
                            className={styles.textActionBtn}
                            title="Reset hardware lock so user can re-pair on a new device"
                          >
                            Reset Device
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOpenDeleteModal(member)}
                            className={styles.textActionDanger}
                            title="Delete user permanently from organization"
                          >
                            Delete from Organization
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Custom Delete Confirmation Modal */}
      <DeleteMemberModal
        isOpen={isDeleteModalOpen}
        member={memberToDelete}
        churchName={church?.churchName || 'Your Organization'}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setMemberToDelete(null);
        }}
        onConfirmDelete={handleConfirmDelete}
      />
    </div>
  );
};
