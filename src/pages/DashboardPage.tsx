import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Wifi,
  MapPin,
  Search,
  ArrowUpRight,
  Radio,
  Trash2,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import {
  subscribeToAttendance,
  clearAllAttendance,
} from "../services/dataService";
import type { AttendanceRecord } from "../types";
import styles from "./DashboardPage.module.css";

export const DashboardPage: React.FC = () => {
  const { church } = useAuth();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>("ALL");
  const [verificationFilter, setVerificationFilter] = useState<
    "ALL" | "WIFI_BSSID" | "GEO_FALLBACK"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    if (!church?.id) return;
    const unsubscribe = subscribeToAttendance(church.id, (records) => {
      setAttendance(records);
    });
    return () => unsubscribe();
  }, [church?.id]);

  // Metric computations (No late concept: attendance window strictly gates sign-in)
  const totalCheckedIn = attendance.length;
  const wifiVerifiedCount = attendance.filter(
    (a) => a.verificationMethod === "WIFI_BSSID",
  ).length;
  const geoVerifiedCount = attendance.filter(
    (a) => a.verificationMethod === "GEO_FALLBACK",
  ).length;
  const activeDepartments = Array.from(
    new Set(attendance.map((a) => a.department)),
  ).length;
  const allDepartments = church?.departments || [];

  // Filtered attendance stream
  const filteredRecords = useMemo(() => {
    return attendance.filter((item) => {
      const matchDept =
        selectedDept === "ALL" || item.department === selectedDept;
      const matchMethod =
        verificationFilter === "ALL" ||
        item.verificationMethod === verificationFilter;
      const matchSearch =
        searchQuery.trim() === "" ||
        item.memberName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.department.toLowerCase().includes(searchQuery.toLowerCase());
      return matchDept && matchMethod && matchSearch;
    });
  }, [attendance, selectedDept, verificationFilter, searchQuery]);

  // Format punch & sync times with seconds precision
  const formatTimeWithSec = (isoString?: string) => {
    if (!isoString) return "—";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  // Compute sync latency (delta between device punch and cloud sync)
  const getSyncLatencyInfo = (punchedAt: string, syncedAt?: string) => {
    if (!syncedAt) {
      return { label: "Real-time (<1s)", isDelayed: false };
    }
    const p = new Date(punchedAt).getTime();
    const s = new Date(syncedAt).getTime();
    const diffSec = Math.max(0, Math.round((s - p) / 1000));
    if (diffSec <= 3) {
      return { label: "Real-time (<3s)", isDelayed: false };
    }
    if (diffSec < 60) {
      return { label: `+${diffSec}s delay`, isDelayed: true };
    }
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    if (mins < 60) {
      return { label: `+${mins}m ${secs}s (Buffer)`, isDelayed: true };
    }
    const hrs = Math.floor(mins / 60);
    return { label: `+${hrs}h ${mins % 60}m (Buffer)`, isDelayed: true };
  };

  const handleClearFeed = () => {
    clearAllAttendance();
    setAttendance([]);
    toast.success("All attendance records cleared.");
  };

  const todayFormatted = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isGeofenceOnly = church?.beaconConfig?.verificationMode === "GEOFENCE_ONLY";

  const isWifiConfigured = Boolean(
    church?.beaconConfig?.ssidHint &&
    church.beaconConfig.ssidHint.trim() !== "" &&
    church?.beaconConfig?.targetBssid &&
    church.beaconConfig.targetBssid.trim() !== "",
  );

  const isGeoConfigured = Boolean(
    (church?.isCalibrated || church?.geoFallback?.isCalibrated || church?.geoFallback?.isConfigured) &&
    church?.geoFallback &&
    church.geoFallback.radiusMeters > 0 &&
    (church.geoFallback.latitude !== 0 || church.geoFallback.longitude !== 0)
  );

  const isFullyConfigured = isGeofenceOnly ? isGeoConfigured : (isWifiConfigured && isGeoConfigured);

  return (
    <div className={styles.dashboardContainer}>
      {/* Sleek Header */}
      <div className={styles.headerSection}>
        <div className={styles.headerTitleWrapper}>
          <div className={styles.titleRow}>
            <h1 className={styles.headerTitle}>Live Attendance Feed</h1>
          </div>
          <p className={styles.headerSubtitle}>
            {todayFormatted} • Real-time workforce verification across premises
            Wi-Fi & GPS boundaries
          </p>
        </div>

        <div className={styles.headerActions}>
          {attendance.length > 0 && (
            <button
              type="button"
              onClick={handleClearFeed}
              className={styles.clearFeedBtn}
              title="Clear all displayed attendance records"
            >
              <Trash2 size={14} />
              <span>Clear Feed</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Presence Anchor Bar */}
      {!isFullyConfigured ? (
        <div className={styles.anchorAlertBar}>
          <div className={styles.anchorAlertLeft}>
            <Radio size={16} color="#D97706" />
            <span>
              <strong>Presence Anchors Uncalibrated:</strong>{" "}
              {isGeofenceOnly
                ? "Configure premises GPS geofence boundary coordinates to activate automated mobile verification."
                : "Configure organization Wi-Fi and geofence coordinates to activate automated mobile verification."}
            </span>
          </div>
          <Link to="/settings/beacon" className={styles.anchorAlertLink}>
            Configure Anchors →
          </Link>
        </div>
      ) : (
        <div className={styles.anchorActiveBar}>
          <div className={styles.anchorPills}>
            <span className={styles.anchorItem}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  backgroundColor: "#10B981",
                }}
              />
              <strong>Anchors Active:</strong>
            </span>
            {isGeofenceOnly ? (
              <span className={styles.anchorItem}>
                <Radio size={13} color="#059669" />
                <span>Mode: Router-Free (GPS)</span>
              </span>
            ) : (
              <span className={styles.anchorItem}>
                <Wifi size={13} color="#059669" />
                <span>Wi-Fi: {church?.beaconConfig?.targetBssid}</span>
              </span>
            )}
            <span className={styles.anchorItem}>
              <MapPin size={13} color="#2563EB" />
              <span>
                Geofence: {church?.geoFallback?.radiusMeters}m perimeter
              </span>
            </span>
          </div>
          <Link
            to="/settings/beacon"
            style={{
              color: "#2563EB",
              textDecoration: "none",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 2,
            }}
          >
            <span>Manage Anchors</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      )}

      {/* Clean Metric Cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Total Clocked In</span>
          <span className={styles.metricValue}>{totalCheckedIn}</span>
          <span className={styles.metricSubtext}>
            Verified on-premise today
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Wi-Fi Verified</span>
          <span className={styles.metricValue} style={{ color: "#059669" }}>
            {wifiVerifiedCount}
          </span>
          <span className={styles.metricSubtext}>
            {totalCheckedIn > 0
              ? `${Math.round((wifiVerifiedCount / totalCheckedIn) * 100)}% via router hardware`
              : "Primary presence anchor"}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>GPS Geofence Verified</span>
          <span className={styles.metricValue} style={{ color: "#2563EB" }}>
            {geoVerifiedCount}
          </span>
          <span className={styles.metricSubtext}>
            {totalCheckedIn > 0
              ? `${Math.round((geoVerifiedCount / totalCheckedIn) * 100)}% via 10m perimeter`
              : "Fail-safe presence anchor"}
          </span>
        </div>

        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Active Units</span>
          <span className={styles.metricValue}>{activeDepartments}</span>
          <span className={styles.metricSubtext}>
            Of {allDepartments.length} registered departments
          </span>
        </div>
      </div>

      {/* Sleek Live Feed Table & Controls */}
      <div className={styles.feedCard}>
        {/* Horizontal Department Chips */}
        <div className={styles.deptScroller}>
          <button
            type="button"
            onClick={() => setSelectedDept("ALL")}
            className={`${styles.deptChip} ${selectedDept === "ALL" ? styles.deptChipActive : ""}`}
          >
            <span>All Departments</span>
            <span className={styles.deptChipBadge}>{attendance.length}</span>
          </button>
          {allDepartments.map((dept) => {
            const count = attendance.filter(
              (a) => a.department === dept,
            ).length;
            return (
              <button
                key={dept}
                type="button"
                onClick={() => setSelectedDept(dept)}
                className={`${styles.deptChip} ${selectedDept === dept ? styles.deptChipActive : ""}`}
              >
                <span>{dept}</span>
                <span className={styles.deptChipBadge}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* Toolbar: Search (Fixed Icon Padding) + Verification Method Filter */}
        <div className={styles.feedToolbar}>
          <div className={styles.toolbarLeft}>
            <div className={styles.searchInputWrapper}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff by name or unit..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>

            <div className={styles.statusFilterGroup}>
              <button
                type="button"
                onClick={() => setVerificationFilter("ALL")}
                className={`${styles.statusFilterBtn} ${verificationFilter === "ALL" ? styles.statusFilterBtnActive : ""}`}
              >
                All Check-Ins
              </button>
              <button
                type="button"
                onClick={() => setVerificationFilter("WIFI_BSSID")}
                className={`${styles.statusFilterBtn} ${verificationFilter === "WIFI_BSSID" ? styles.statusFilterBtnActive : ""}`}
              >
                Wi-Fi
              </button>
              <button
                type="button"
                onClick={() => setVerificationFilter("GEO_FALLBACK")}
                className={`${styles.statusFilterBtn} ${verificationFilter === "GEO_FALLBACK" ? styles.statusFilterBtnActive : ""}`}
              >
                GPS Geofence
              </button>
            </div>
          </div>

          <div className={styles.recordCountPill}>
            Showing {filteredRecords.length}{" "}
            {filteredRecords.length === 1 ? "record" : "records"}
          </div>
        </div>

        {/* Clean Data Table */}
        <div
          className="data-table-container"
          style={{ border: "none", borderRadius: 0 }}
        >
          <table className="data-table">
            <thead>
              <tr>
                <th>Team Member</th>
                <th>Clock-In Time</th>
                <th>Cloud Sync Time</th>
                <th>Sync Latency</th>
                <th>Verification Anchor</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyStateTitle}>
                        No check-ins found
                      </div>
                      <div className={styles.emptyStateSub}>
                        {attendance.length === 0
                          ? "No attendance records logged for today yet. When staff or team members punch in from the mobile app, verification events stream here in real time."
                          : "No entries match your search or filter criteria."}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredRecords.map((item) => {
                  const latency = getSyncLatencyInfo(
                    item.punchedAt,
                    item.syncedAt,
                  );

                  return (
                    <tr key={item.id}>
                      <td>
                        <div className={styles.memberNameCol}>
                          <span className={styles.memberName}>
                            {item.memberName}
                          </span>
                          <span className={styles.memberDeptTag}>
                            {item.department}
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className={styles.timeDisplay}>
                          <span>{formatTimeWithSec(item.punchedAt)}</span>
                          <span className={styles.timeSubBadge}>
                            device stamp
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className={styles.timeDisplay}>
                          <span>
                            {formatTimeWithSec(item.syncedAt || item.punchedAt)}
                          </span>
                          <span className={styles.timeSubBadge}>
                            db received
                          </span>
                        </div>
                      </td>

                      <td>
                        <span
                          className={`badge ${!latency.isDelayed ? "badge-success" : "badge-warning"}`}
                          title={
                            !latency.isDelayed
                              ? "Real-time sync"
                              : "Buffered offline before sync"
                          }
                        >
                          {latency.label}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`badge ${item.verificationMethod === "WIFI_BSSID" ? "badge-success" : "badge-info"}`}
                        >
                          {item.verificationMethod === "WIFI_BSSID"
                            ? "Wi-Fi Anchor"
                            : "GPS Geofence"}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
