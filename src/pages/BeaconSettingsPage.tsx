import React, { useState, useEffect, useRef } from "react";
import {
  Wifi,
  MapPin,
  CheckCircle2,
  AlertTriangle,
  Radio,
  RefreshCw,
  Edit3,
  ShieldCheck,
  ChevronDown,
  QrCode,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import { GooglePresenceMap } from "../components/common/GooglePresenceMap";
import styles from "./BeaconSettingsPage.module.css";

export const BeaconSettingsPage: React.FC = () => {
  const { user, church } = useAuth();

  // Synchronous initialization from church context if present
  const isInitiallyCalibrated = Boolean(
    church?.isCalibrated ||
    church?.geoFallback?.isCalibrated ||
    (church?.geoFallback?.isConfigured &&
      (church?.beaconConfig?.targetBssid ||
        church?.beaconConfig?.verificationMode === "GEOFENCE_ONLY")) ||
    (Number(church?.geoFallback?.latitude ?? 0) !== 0 &&
      Number(church?.geoFallback?.longitude ?? 0) !== 0)
  );

  const initialMode: "HYBRID" | "GEOFENCE_ONLY" =
    church?.beaconConfig?.verificationMode === "HYBRID" ? "HYBRID" : "GEOFENCE_ONLY";

  // Anchors state with synchronous defaults from church
  const [ssidHint, setSsidHint] = useState<string>(() => (isInitiallyCalibrated ? church?.beaconConfig?.ssidHint || "" : ""));
  const [targetBssid, setTargetBssid] = useState<string>(() => (isInitiallyCalibrated ? church?.beaconConfig?.targetBssid || "" : ""));
  const [latitude, setLatitude] = useState<number>(() => (isInitiallyCalibrated ? Number(church?.geoFallback?.latitude ?? 4.975) : 4.975));
  const [longitude, setLongitude] = useState<number>(() => (isInitiallyCalibrated ? Number(church?.geoFallback?.longitude ?? 8.3417) : 8.3417));
  const [radiusMeters, setRadiusMeters] = useState<number>(() => (isInitiallyCalibrated ? Number(church?.geoFallback?.radiusMeters ?? 10) : 10));
  const [pinnedLocationName, setPinnedLocationName] = useState<string>(() => (isInitiallyCalibrated ? church?.branchName || church?.churchName || "" : ""));
  const [isCalibratedLive, setIsCalibratedLive] = useState<boolean>(() => isInitiallyCalibrated);

  // View state: OVERVIEW (if already calibrated) vs QR_STATION (to calibrate)
  const [viewMode, setViewMode] = useState<"OVERVIEW" | "QR_STATION">(
    isInitiallyCalibrated ? "OVERVIEW" : "QR_STATION",
  );
  const [isDataMounted, setIsDataMounted] = useState<boolean>(false);
  const hasInitializedViewRef = useRef<boolean>(false);

  // Session notification tracking refs to prevent duplicate toasts and revisit toasts
  const lastAnnouncedSessionRef = useRef<{
    completedAt?: string;
    disconnectedAt?: string;
  }>({});
  const isInitialMountRef = useRef<boolean>(true);

  // Setup Wizard State
  type SetupStep = "CHOOSE_MODE" | "ROUTER_PREREQUISITE" | "SHOW_QR";
  const [setupStep, setSetupStep] = useState<SetupStep>("CHOOSE_MODE");
  const [selectedMode, setSelectedMode] = useState<"HYBRID" | "GEOFENCE_ONLY">(initialMode);

  // Real-time Calibration Session state
  const [calibrationSession, setCalibrationSession] = useState<{
    status: "AWAITING_SCAN" | "CONNECTED" | "COMPLETED";
    connectedAt?: string;
    completedAt?: string;
    platform?: string;
  }>({ status: "AWAITING_SCAN" });

  const calibrationSessionRef = useRef(calibrationSession);
  calibrationSessionRef.current = calibrationSession;
  const viewModeRef = useRef(viewMode);
  viewModeRef.current = viewMode;

  // Kill signal on page unmount / route leave / window close if pairing was active
  useEffect(() => {
    const notifyMobileDisconnect = () => {
      const isConnected = (calibrationSessionRef.current.status as string) === "CONNECTED";
      if (db && church?.id && isConnected) {
        const churchRef = doc(db, "churches", church.id);
        const sessionRef = doc(db, "churches", church.id, "calibration", "session");
        const payload = {
          status: "DISCONNECTED",
          disconnectedAt: new Date().toISOString(),
          reason: "ADMIN_LEFT_PAGE",
        };
        updateDoc(churchRef, {
          "calibrationSession.status": "DISCONNECTED",
          "calibrationSession.disconnectedAt": payload.disconnectedAt,
          "calibrationSession.reason": "ADMIN_LEFT_PAGE",
        }).catch(() => {});
        setDoc(sessionRef, payload, { merge: true }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", notifyMobileDisconnect);
    return () => {
      window.removeEventListener("beforeunload", notifyMobileDisconnect);
      notifyMobileDisconnect();
    };
  }, [church?.id]);

  // Clipboard & helper states
  const [copiedMac, setCopiedMac] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyEmail = (email: string) => {
    if (!email) return;
    navigator.clipboard.writeText(email);
    setCopiedEmail(true);
    toast.success("Admin email copied to clipboard!");
    setTimeout(() => setCopiedEmail(false), 2000);
  };

  const handleCopyCode = (code: string) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    toast.success("Organization code copied to clipboard!");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  // Initialize data from church profile
  useEffect(() => {
    if (church) {
      const isExplicitlyCalibrated = Boolean(
        church.isCalibrated ||
        church.geoFallback?.isCalibrated ||
        (church.geoFallback?.isConfigured &&
          (church.beaconConfig?.targetBssid ||
            church.beaconConfig?.verificationMode === "GEOFENCE_ONLY")) ||
        (Number(church.geoFallback?.latitude ?? 0) !== 0 &&
          Number(church.geoFallback?.longitude ?? 0) !== 0)
      );

      if (isExplicitlyCalibrated) {
        setIsCalibratedLive(true);
      }

      const savedSsid = isExplicitlyCalibrated ? (church.beaconConfig?.ssidHint || "") : "";
      const savedBssid = isExplicitlyCalibrated ? (church.beaconConfig?.targetBssid || "") : "";
      const savedLat = isExplicitlyCalibrated ? Number(church.geoFallback?.latitude ?? 0) : 0;
      const savedLng = isExplicitlyCalibrated ? Number(church.geoFallback?.longitude ?? 0) : 0;
      const savedRadius = isExplicitlyCalibrated ? Number(church.geoFallback?.radiusMeters ?? 10) : 10;
      const savedLabel = isExplicitlyCalibrated ? (church.branchName || church.churchName || "") : "";

      setSsidHint(savedSsid);
      setTargetBssid(savedBssid);
      setLatitude(savedLat);
      setLongitude(savedLng);
      setRadiusMeters(savedRadius);
      setPinnedLocationName(savedLabel);

      if (!hasInitializedViewRef.current) {
        if (church.beaconConfig?.verificationMode) {
          setSelectedMode(church.beaconConfig.verificationMode);
        }
        setViewMode(isExplicitlyCalibrated ? "OVERVIEW" : "QR_STATION");
        hasInitializedViewRef.current = true;
      }
      setIsDataMounted(true);
    }
  }, [church]);

  // Real-time Firestore session listener: churches/{churchId}/calibration/session
  useEffect(() => {
    if (!db || !church?.id) return;

    const sessionRef = doc(db, "churches", church.id, "calibration", "session");

    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.status) {
          setCalibrationSession((prev) => ({
            ...prev,
            status: data.status,
            connectedAt: data.connectedAt,
            completedAt: data.completedAt,
            platform: data.platform,
          }));

          // Avoid announcing status from a previous session on page load / revisit
          if (isInitialMountRef.current) {
            lastAnnouncedSessionRef.current = {
              completedAt: data.completedAt,
              disconnectedAt: data.disconnectedAt,
            };
            isInitialMountRef.current = false;
            return;
          }

          if (data.status === "COMPLETED") {
            const completedKey = data.completedAt || "completed";
            if (lastAnnouncedSessionRef.current.completedAt !== completedKey) {
              lastAnnouncedSessionRef.current.completedAt = completedKey;
              toast.success(
                "Premises anchors successfully calibrated via mobile device!",
              );
              setViewMode("OVERVIEW");
              setIsCalibratedLive(true);
            }
          } else if (
            data.status === "DISCONNECTED" ||
            data.status === "CANCELLED"
          ) {
            const disconnectedKey = data.disconnectedAt || "disconnected";
            if (lastAnnouncedSessionRef.current.disconnectedAt !== disconnectedKey) {
              lastAnnouncedSessionRef.current.disconnectedAt = disconnectedKey;
              toast.info("Mobile device disconnected from calibration session.");
              setCalibrationSession({ status: "AWAITING_SCAN" });
            }
          }
        }
      } else {
        isInitialMountRef.current = false;
      }
    }, (err) => {
      console.warn("Session snapshot notice:", err);
    });

    return () => unsubscribe();
  }, [church?.id]);

  // Real-time Firestore church listener: updates web portal immediately when mobile commits
  useEffect(() => {
    if (!db || !church?.id) return;

    const churchRef = doc(db, "churches", church.id);
    const unsubscribe = onSnapshot(churchRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        // 1. Sync calibration session state if present
        if (data?.calibrationSession?.status) {
          setCalibrationSession((prev) => ({
            ...prev,
            status: data.calibrationSession.status,
            connectedAt: data.calibrationSession.connectedAt,
            completedAt: data.calibrationSession.completedAt,
            platform: data.calibrationSession.platform,
          }));

          if (data.calibrationSession.status === "COMPLETED") {
            setViewMode("OVERVIEW");
            setIsCalibratedLive(true);
          } else if (data.calibrationSession.status === "DISCONNECTED") {
            setCalibrationSession({ status: "AWAITING_SCAN" });
          }
        }

        const freshBssid = data?.beaconConfig?.targetBssid || "";
        const freshSsid = data?.beaconConfig?.ssidHint || "";
        const freshLat = Number(data?.geoFallback?.latitude ?? 0);
        const freshLng = Number(data?.geoFallback?.longitude ?? 0);
        const freshRadius = Number(data?.geoFallback?.radiusMeters ?? 10);
        const isExplicit = Boolean(
          data?.isCalibrated ||
          data?.geoFallback?.isCalibrated ||
          (data?.geoFallback?.isConfigured &&
            (freshBssid || data?.beaconConfig?.verificationMode === "GEOFENCE_ONLY")) ||
          (freshLat !== 0 && freshLng !== 0)
        );

        if (isExplicit) {
          setIsCalibratedLive(true);
          if (freshBssid) setTargetBssid(freshBssid);
          if (freshSsid) setSsidHint(freshSsid);
          if (freshLat && freshLng) {
            setLatitude(freshLat);
            setLongitude(freshLng);
            setRadiusMeters(freshRadius);

            // Reverse geocode venue address dynamically so label updates immediately
            import("../services/geocodingService")
              .then(({ reverseGeocode }) => {
                reverseGeocode(freshLat, freshLng)
                  .then((geo) => {
                    if (geo?.displayName) setPinnedLocationName(geo.displayName);
                  })
                  .catch(() => {});
              })
              .catch(() => {});
          }
        }

        // Keep local storage in sync
        const freshChurch: any = {
          ...church,
          beaconConfig: {
            ssidHint: freshSsid || ssidHint,
            targetBssid: freshBssid || targetBssid,
          },
          geoFallback: {
            latitude: freshLat || latitude,
            longitude: freshLng || longitude,
            radiusMeters: freshRadius || radiusMeters,
            isConfigured: isExplicit,
            isCalibrated: isExplicit,
          },
          isCalibrated: isExplicit,
        };
        try {
          localStorage.setItem(
            `sanctuary_church_${church.id}`,
            JSON.stringify(freshChurch),
          );
          localStorage.setItem(
            "sanctuary_church_data",
            JSON.stringify(freshChurch),
          );
        } catch {}
      }
    }, (err) => {
      console.warn("Church snapshot notice:", err);
    });

    return () => unsubscribe();
  }, [church?.id]);

  // Start or restart QR calibration session
  const handleStartQrSession = async (overrideMode?: "HYBRID" | "GEOFENCE_ONLY") => {
    setViewMode("QR_STATION");

    if (overrideMode) {
      setSelectedMode(overrideMode);
      if (overrideMode === "GEOFENCE_ONLY") {
        setSetupStep("SHOW_QR");
      } else {
        setSetupStep("ROUTER_PREREQUISITE");
      }
    } else {
      setSetupStep("CHOOSE_MODE");
    }

    setCalibrationSession({ status: "AWAITING_SCAN" });
    lastAnnouncedSessionRef.current = {};

    if (db && church?.id) {
      try {
        const churchRef = doc(db, "churches", church.id);
        const sessionRef = doc(db, "churches", church.id, "calibration", "session");
        const sessionMode = overrideMode || selectedMode;
        await Promise.all([
          updateDoc(churchRef, {
            "calibrationSession.status": "AWAITING_SCAN",
            "calibrationSession.mode": sessionMode,
            "calibrationSession.startedAt": new Date().toISOString(),
          }).catch(() => {}),
          setDoc(
            sessionRef,
            {
              status: "AWAITING_SCAN",
              mode: sessionMode,
              startedAt: new Date().toISOString(),
            },
            { merge: true },
          ).catch(() => {}),
        ]);
      } catch (err) {
        console.warn("Could not set session in Firestore:", err);
      }
    }
  };

  const handleSelectModeAndShowQr = async (mode: "HYBRID" | "GEOFENCE_ONLY") => {
    setSelectedMode(mode);
    setSetupStep("SHOW_QR");
    setCalibrationSession({ status: "AWAITING_SCAN" });

    if (db && church?.id) {
      try {
        const churchRef = doc(db, "churches", church.id);
        const sessionRef = doc(db, "churches", church.id, "calibration", "session");
        await Promise.all([
          updateDoc(churchRef, {
            "calibrationSession.status": "AWAITING_SCAN",
            "calibrationSession.mode": mode,
            "calibrationSession.startedAt": new Date().toISOString(),
          }).catch(() => {}),
          setDoc(
            sessionRef,
            {
              status: "AWAITING_SCAN",
              mode,
              startedAt: new Date().toISOString(),
            },
            { merge: true },
          ).catch(() => {}),
        ]);
      } catch (err) {
        console.warn("Could not set session in Firestore:", err);
      }
    }
  };

  const handleCopyMac = () => {
    if (!targetBssid) return;
    navigator.clipboard.writeText(targetBssid);
    setCopiedMac(true);
    setTimeout(() => setCopiedMac(false), 2000);
  };

  // Compact QR Code Payload for instant recognition (<50ms like WhatsApp/Xender)
  const qrPayload = JSON.stringify({
    t: "CAL",
    id: church?.id || "",
    c: church?.churchCode || "ORG",
    n: church?.branchName || church?.churchName || "Organization",
    type: "CALIBRATE_ANCHORS",
    mode: selectedMode,
    churchId: church?.id || "",
    churchCode: church?.churchCode || "ORG",
  });

  const isGeofenceOnly =
    church?.beaconConfig?.verificationMode === "GEOFENCE_ONLY" ||
    (selectedMode === "GEOFENCE_ONLY" && !targetBssid);

  const isExplicitlyCalibrated = Boolean(
    isCalibratedLive ||
    church?.isCalibrated ||
    church?.geoFallback?.isCalibrated ||
    (church?.geoFallback?.isConfigured &&
      (targetBssid || church?.beaconConfig?.verificationMode === "GEOFENCE_ONLY")) ||
    ((latitude !== 0 || longitude !== 0) && radiusMeters > 0)
  );

  const isWifiConfigured = Boolean(
    isExplicitlyCalibrated && targetBssid && targetBssid.trim() !== "",
  );

  const isGeoConfigured = Boolean(
    isExplicitlyCalibrated &&
    radiusMeters > 0 &&
    (latitude !== 0 || longitude !== 0)
  );

  if (!isDataMounted) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.loadingContainer}>
          <div className={styles.loadingCard}>
            <RefreshCw size={32} className={styles.spinner} color="#2563EB" />
            <h3 style={{ margin: "16px 0 6px 0", fontSize: "1.1rem", color: "#1E293B", fontWeight: 700 }}>
              Checking Presence Anchors...
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B" }}>
              Retrieving premises configuration and calibration parameters
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div>
          <div className="section-tag">// HARDWARE ANCHORS & GEOFENCE TELEMETRY</div>
          <h1 className={styles.headerTitle}>Premises Presence Anchors</h1>
          <p className={styles.headerSubtitle}>
            Calibrate physical premises verification boundaries. Pair with your
            smartphone to detect hardware Wi-Fi radio airwaves and satellite
            coordinates.
          </p>
        </div>
      </div>

      {/* Dynamic Architecture Callout */}
      <div className={styles.systemArchitectureBanner}>
        <Radio size={20} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
        <div className={styles.systemArchitectureText}>
          {isGeofenceOnly ? (
            <>
              <strong>GPS Geofence Perimeter Mode:</strong> Worker clock-ins authenticate directly via satellite GPS coordinates (<strong style={{ color: "#059669" }}>&lt; 1s instant check-in</strong>). Office Wi-Fi scanning is disabled for your organization.
            </>
          ) : (
            <>
              <strong>Dual-Anchor Redundancy:</strong> Worker clock-ins first
              authenticate via physical router radio hardware (Section A). If the
              premises router is offline, the mobile app automatically transitions
              to verifying attendance against the{" "}
              <strong>Geofence Perimeter</strong> in Section B within a{" "}
              <strong>3.5s timeout</strong>.
            </>
          )}
        </div>
      </div>

      {/* ====================================================================
          VIEW MODE 1: CALIBRATED OVERVIEW (Active Anchors)
          ==================================================================== */}
      {viewMode === "OVERVIEW" && (
        <div className={styles.collapsedContainer}>
          <div className={styles.collapsedHeaderCard}>
            <div className={styles.collapsedHeaderLeft}>
              <div className={styles.calibratedShieldIcon}>
                <ShieldCheck size={26} />
              </div>
              <div className={styles.collapsedHeaderTexts}>
                <div className={styles.collapsedHeaderTitleRow}>
                  <h3>
                    {isGeofenceOnly
                      ? "Satellite GPS Presence Anchor Active"
                      : "Dual Presence Anchors Active & Synchronized"}
                  </h3>
                  <span className={styles.activeStatusBadge}>
                    <span className={styles.activeStatusDot} /> Live Cloud Sync
                  </span>
                </div>
                <p className={styles.collapsedHeaderSub}>
                  {isGeofenceOnly
                    ? "Workers verify attendance instantly against the high-accuracy geofence perimeter."
                    : "Workers verify attendance against the premises router BSSID with automated GPS geofence failover."}
                </p>
              </div>
            </div>

            <button
              type="button"
              className={styles.recalibrateActionBtn}
              onClick={() => handleStartQrSession()}
              title="Pair with mobile app to re-calibrate anchors"
            >
              <QrCode size={18} />
              <span>Re-calibrate via Mobile QR</span>
            </button>
          </div>

          <div className={styles.collapsedSummaryGrid}>
            {/* Section A Summary Card */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardHeader}>
                <div className={styles.summaryCardTitleGroup}>
                  <div
                    className={`${styles.summaryCardIcon} ${styles.iconWifi}`}
                    style={isGeofenceOnly ? { backgroundColor: "#F1F5F9", color: "#94A3B8" } : undefined}
                  >
                    <Wifi size={20} />
                  </div>
                  <div>
                    <h4>Section A — Premises Wi-Fi Anchor</h4>
                    <span>Hardware Radio Presence</span>
                  </div>
                </div>
                {isGeofenceOnly ? (
                  <button
                    type="button"
                    className={styles.editCardBtn}
                    onClick={() => handleStartQrSession("HYBRID")}
                    title="Add office router to enable hybrid verification"
                  >
                    <Wifi size={13} />
                    <span>+ Add Office Router</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className={styles.editCardBtn}
                    onClick={() => handleStartQrSession("HYBRID")}
                    title="Re-calibrate router"
                  >
                    <Edit3 size={13} />
                    <span>Re-scan Router</span>
                  </button>
                )}
              </div>

              <div className={styles.summaryDataRows}>
                {isGeofenceOnly ? (
                  <>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>
                        Configuration Mode
                      </span>
                      <span className={styles.summaryDataValue}>
                        GPS Geofence Only
                      </span>
                    </div>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>
                        Hardware MAC (BSSID)
                      </span>
                      <span className={styles.summaryDataValue} style={{ color: "#94A3B8" }}>
                        Not Required / Inactive
                      </span>
                    </div>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>
                        Verification Gateway
                      </span>
                      <span className={styles.summaryDataValue}>
                        Bypassed · Instant GPS Verification
                      </span>
                    </div>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>Status</span>
                      <span
                        style={{
                          color: "#64748B",
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <CheckCircle2 size={14} color="#10B981" /> No Physical Router Needed
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>
                        Configured SSID
                      </span>
                      <span className={styles.summaryDataValue}>
                        {ssidHint || "Pending Calibration"}
                      </span>
                    </div>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>
                        Hardware MAC (BSSID)
                      </span>
                      <div
                        style={{ display: "flex", alignItems: "center", gap: 6 }}
                      >
                        <span className={styles.summaryDataValueMono}>
                          {targetBssid || "Pending Calibration"}
                        </span>
                        {targetBssid && (
                          <button
                            type="button"
                            onClick={handleCopyMac}
                            style={{
                              border: "none",
                              background: "none",
                              cursor: "pointer",
                              color: copiedMac ? "#059669" : "#64748B",
                              padding: 2,
                            }}
                            title="Copy MAC Address"
                          >
                            {copiedMac ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>
                        Verification Gateway
                      </span>
                      <span className={styles.summaryDataValue}>
                        Primary · 3.5s Timeout
                      </span>
                    </div>
                    <div className={styles.summaryDataRow}>
                      <span className={styles.summaryDataLabel}>Status</span>
                      <span
                        style={{
                          color: isWifiConfigured ? "#059669" : "#D97706",
                          fontWeight: 700,
                          fontSize: "0.8rem",
                          display: "flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        {isWifiConfigured ? (
                          <>
                            <CheckCircle2 size={14} /> Active &amp; Locked
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={14} /> Unconfigured · Scan QR
                          </>
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Section B Summary Card */}
            <div className={styles.summaryCard}>
              <div className={styles.summaryCardHeader}>
                <div className={styles.summaryCardTitleGroup}>
                  <div
                    className={`${styles.summaryCardIcon} ${styles.iconGeo}`}
                  >
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4>Section B — Geofence Anchor</h4>
                    <span>
                      {isGeofenceOnly
                        ? "Primary Verification Perimeter"
                        : "Calibrated Fail-Safe Perimeter"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.editCardBtn}
                  onClick={() => handleStartQrSession("GEOFENCE_ONLY")}
                  title="Calibrate or update geofence coordinates via mobile device"
                >
                  <Smartphone size={13} />
                  <span>Calibrate via Mobile</span>
                </button>
              </div>

              {/* Static Read-Only Overview */}
              <div className={styles.summaryDataRows}>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Calibrated Venue
                  </span>
                  <span className={styles.summaryDataValue}>
                    {pinnedLocationName ||
                      church?.branchName ||
                      church?.churchName ||
                      "Premises Boundary"}
                  </span>
                </div>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Precise Coordinates
                  </span>
                  <span className={styles.summaryDataValueMono}>
                    {isGeoConfigured
                      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                      : "Pending Calibration"}
                  </span>
                </div>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Perimeter Boundary
                  </span>
                  <span className={styles.summaryDataValue}>
                    {isGeoConfigured
                      ? `${radiusMeters}m radius (${radiusMeters * 2}m diameter)`
                      : "Unconfigured"}
                  </span>
                </div>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    {isGeofenceOnly ? "Primary Rule" : "Failover Rule"}
                  </span>
                  <span
                    style={{
                      color: isGeoConfigured ? "#2563EB" : "#D97706",
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {isGeoConfigured ? (
                      <>
                        <CheckCircle2 size={14} />
                        {isGeofenceOnly
                          ? "Active · Primary Presence Anchor"
                          : "Active on 3.5s Timeout"}
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} /> Unconfigured · Calibrate on Mobile
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Mini Map Preview */}
              <div
                style={{
                  marginTop: "4px",
                  borderRadius: "10px",
                  overflow: "hidden",
                }}
              >
                <GooglePresenceMap
                  latitude={latitude}
                  longitude={longitude}
                  radiusMeters={radiusMeters}
                  locationLabel={
                    pinnedLocationName ||
                    church?.branchName ||
                    church?.churchName
                  }
                  height={190}
                  hideOverlay
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          VIEW MODE 2: MOBILE QR CALIBRATION STATION
          ==================================================================== */}
      {viewMode === "QR_STATION" && (
        <div className={styles.qrStationCard}>
          <div className={styles.qrStationHeader}>
            <div className={styles.qrStationTitleGroup}>
              <div className={styles.qrStationIconBadge}>
                <QrCode size={24} />
              </div>
              <div>
                <h2>Calibrate Premises Anchors via Mobile App</h2>
                <p>
                  Smartphones have direct access to physical Wi-Fi radio chips
                  and high-precision GPS sensors.
                </p>
              </div>
            </div>

            <div className={styles.qrLiveListeningPill}>
              <span className={styles.pulsingDot} />
              <span>Live Cloud Sync Active</span>
            </div>
          </div>

          {/* Direct Mobile Calibration Callout */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "14px",
              padding: "12px 18px",
              backgroundColor: "rgba(45, 129, 255, 0.08)",
              border: "1px solid rgba(45, 129, 255, 0.25)",
              borderRadius: "var(--radius-xs)",
              margin: "0 0 20px 0",
              flexWrap: "wrap",
            }}
          >
            <Smartphone size={20} color="#2563EB" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: "220px" }}>
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.85rem",
                  color: "var(--text-heading)",
                }}
              >
                Direct Mobile App Calibration
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                }}
              >
                You can also calibrate hardware anchors directly inside the
                Presenti Mobile App! Simply log in on your phone with this
                Administrator account and tap <strong>Presence Anchors</strong>.
                No QR scan required.
              </div>
            </div>
          </div>

          {/* Real-time Substate A: Connected & Calibrating on Device */}
          {calibrationSession.status === "CONNECTED" ? (
            <div className={styles.qrConnectedCard}>
              <div className={styles.connectedPulseRing}>
                <Smartphone size={32} />
              </div>
              <h3 className={styles.connectedStatusTitle}>
                Mobile Phone Connected!
              </h3>
              <p className={styles.connectedStatusDesc}>
                {selectedMode === "GEOFENCE_ONLY" ? (
                  <>
                    Your smartphone (<strong>{calibrationSession.platform || "Device"}</strong>) is currently linked in{" "}
                    <strong>GPS Geofence Only</strong> mode. Please confirm your premises coordinates and perimeter radius on your phone, then tap{" "}
                    <strong>Save &amp; Sync to Web Portal</strong>.
                  </>
                ) : (
                  <>
                    Your smartphone (<strong>{calibrationSession.platform || "Device"}</strong>) is currently linked. Please search or select your premises Wi-Fi router and confirm GPS coordinates on your phone, then tap{" "}
                    <strong>Save &amp; Sync to Web Portal</strong>.
                  </>
                )}
              </p>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 16px",
                  borderRadius: "0px",
                  backgroundColor: "var(--bg-surface-warm)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-heading)",
                  fontFamily: "var(--font-mono)",
                  fontSize: "11px",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <RefreshCw size={14} className="spinner" />
                <span>Awaiting premises coordinates from mobile device...</span>
              </div>
              <button
                type="button"
                className={styles.restartSessionBtn}
                onClick={() => handleStartQrSession()}
              >
                Show QR Code Again
              </button>
            </div>
          ) : setupStep === "CHOOSE_MODE" ? (
            /* Wizard Step 1: Select Architecture */
            <div className={styles.wizardContainer}>
              {isExplicitlyCalibrated && (
                <div style={{ marginBottom: "16px" }}>
                  <button
                    type="button"
                    className={styles.backStepBtn}
                    onClick={() => setViewMode("OVERVIEW")}
                  >
                    ← Cancel &amp; Return to Active Anchors
                  </button>
                </div>
              )}
              <div className={styles.wizardHeader}>
                <h3>Step 1: Select Workplace Verification Architecture</h3>
                <p>
                  Choose whether your premises has a physical office Wi-Fi router, or if you prefer satellite GPS geofencing only.
                </p>
              </div>

              <div className={styles.modeCardsGrid}>
                {/* Option 1: Geofence Only (Default & Recommended) */}
                <div
                  className={`${styles.modeOptionCard} ${selectedMode === "GEOFENCE_ONLY" ? styles.modeOptionCardSelected : ""}`}
                  onClick={() => handleSelectModeAndShowQr("GEOFENCE_ONLY")}
                >
                  <div className={styles.modeCardTopRow}>
                    <div className={`${styles.modeCardIcon} ${styles.iconGeo}`}>
                      <MapPin size={24} />
                    </div>
                    <span className={`${styles.modeCardBadge} ${styles.badgeHybrid}`}>
                      Recommended · Instant Setup
                    </span>
                  </div>
                  <div className={styles.modeCardBody}>
                    <h4>Satellite GPS Geofence (Router-Free)</h4>
                    <p>
                      Pure Satellite Presence Verification. Ideal for workforces, field teams, and offices operating on mobile data or shared hotspots.
                    </p>
                    <div className={styles.modeCardFeatureList}>
                      <div className={styles.modeCardFeatureItem}>
                        <Check size={14} /> Zero physical router hardware needed
                      </div>
                      <div className={styles.modeCardFeatureItem}>
                        <Check size={14} /> Uses smartphone satellite GPS chip
                      </div>
                      <div className={styles.modeCardFeatureItem}>
                        <Check size={14} /> Instant sub-second attendance verification
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.modeSelectBtn} ${styles.modeSelectBtnPrimary}`}
                  >
                    <span>Use Satellite GPS Geofence</span>
                    <ChevronDown size={16} style={{ transform: "rotate(-90deg)" }} />
                  </button>
                </div>

                {/* Option 2: Office Router (Hybrid Mode) */}
                <div
                  className={`${styles.modeOptionCard} ${selectedMode === "HYBRID" ? styles.modeOptionCardSelected : ""}`}
                  onClick={() => {
                    setSelectedMode("HYBRID");
                    setSetupStep("ROUTER_PREREQUISITE");
                  }}
                >
                  <div className={styles.modeCardTopRow}>
                    <div className={`${styles.modeCardIcon} ${styles.iconWifi}`}>
                      <Wifi size={24} />
                    </div>
                    <span className={`${styles.modeCardBadge} ${styles.badgeGeofence}`}>
                      Optional · Dual-Tier
                    </span>
                  </div>
                  <div className={styles.modeCardBody}>
                    <h4>Physical Office Wi-Fi Router</h4>
                    <p>
                      Dual-Tier Hybrid Security. Smartphones detect your router's hardware MAC address (BSSID) from surrounding airwaves, backed by GPS geofencing.
                    </p>
                    <div className={styles.modeCardFeatureList}>
                      <div className={styles.modeCardFeatureItem}>
                        <Check size={14} /> Maximum anti-spoofing security
                      </div>
                      <div className={styles.modeCardFeatureItem}>
                        <Check size={14} /> Requires on-site office router
                      </div>
                      <div className={styles.modeCardFeatureItem}>
                        <Check size={14} /> Automatic GPS fail-safe fallback
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={`${styles.modeSelectBtn} ${styles.modeSelectBtnSecondary}`}
                  >
                    <span>Use Office Router (Router + GPS)</span>
                    <ChevronDown size={16} style={{ transform: "rotate(-90deg)" }} />
                  </button>
                </div>
              </div>
            </div>
          ) : setupStep === "ROUTER_PREREQUISITE" ? (
            /* Wizard Step 2: Checklist before scanning */
            <div className={styles.wizardContainer}>
              <div className={styles.wizardHeader}>
                <h3>Step 2: Office Wi-Fi Prerequisite Checklist</h3>
                <p>
                  Please verify these 2 quick conditions before pairing with your smartphone:
                </p>
              </div>

              <div className={styles.prerequisiteBox}>
                {/* Hotspot Alert Banner */}
                <div className={styles.prerequisiteWarningBanner}>
                  <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <strong>Mobile Hotspot Notice:</strong> If this laptop is currently receiving internet from your phone's personal hotspot, please switch both devices to your office router now. Alternatively, you can click <strong>"Back"</strong> below to select <em>GPS Geofence Only</em> (no router needed).
                  </div>
                </div>

                <div className={styles.prerequisiteList}>
                  <div className={styles.prerequisiteItem}>
                    <div className={styles.prerequisiteNumber}>1</div>
                    <div className={styles.prerequisiteText}>
                      <h5>Connect Both Devices to Office Wi-Fi</h5>
                      <p>
                        Ensure both this <strong>computer/laptop</strong> and your <strong>smartphone</strong> are actively connected to the physical Wi-Fi router you want to calibrate as your workplace beacon.
                      </p>
                    </div>
                  </div>

                  <div className={styles.prerequisiteItem}>
                    <div className={styles.prerequisiteNumber}>2</div>
                    <div className={styles.prerequisiteText}>
                      <h5>Switch ON Phone Wi-Fi &amp; Location</h5>
                      <p>
                        Swipe down from the top of your phone screen and confirm that both the <strong>Wi-Fi</strong> and <strong>Location (GPS)</strong> toggles are turned <strong>ON</strong>.
                      </p>
                    </div>
                  </div>
                </div>

                <div className={styles.prerequisiteActions}>
                  <button
                    type="button"
                    className={styles.backStepBtn}
                    onClick={() => setSetupStep("CHOOSE_MODE")}
                  >
                    ← Back to Architecture Options
                  </button>
                  <button
                    type="button"
                    className={styles.proceedStepBtn}
                    onClick={() => handleSelectModeAndShowQr("HYBRID")}
                  >
                    <span>I'm Connected → Show QR Code</span>
                    <ChevronDown size={16} style={{ transform: "rotate(-90deg)" }} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Real-time Substate B: Awaiting Mobile Camera Scan (SHOW_QR) */
            <div>
              {/* Active Mode Bar with Back Switcher */}
              <div className={styles.activeModeBar}>
                <div className={styles.activeModeBadgeLabel}>
                  {selectedMode === "GEOFENCE_ONLY" ? (
                    <>
                      <MapPin size={16} color="#16A34A" />
                      <span>Target Architecture: GPS Satellite Geofence Only (Router-Free)</span>
                    </>
                  ) : (
                    <>
                      <Wifi size={16} color="#0284C7" />
                      <span>Target Architecture: Physical Wi-Fi Router + GPS (Hybrid)</span>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isExplicitlyCalibrated && (
                    <button
                      type="button"
                      className={styles.backStepBtn}
                      style={{ padding: "4px 10px", fontSize: "0.8rem" }}
                      onClick={() => setViewMode("OVERVIEW")}
                    >
                      ← Return to Overview
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.changeModeLinkBtn}
                    onClick={() => setSetupStep("CHOOSE_MODE")}
                  >
                    Change Setup Architecture
                  </button>
                </div>
              </div>

              <div className={styles.qrStationContent}>
                {/* QR Code Container */}
                <div className={styles.qrCodeFrame}>
                  <div className={styles.qrSvgWrapper}>
                    <QRCodeSVG
                      value={qrPayload}
                      size={260}
                      level="M"
                      includeMargin={true}
                    />
                  </div>
                  {church?.churchCode && (
                    <div className={styles.qrCodeOrgBadge}>
                      Organization: {church.churchCode}
                    </div>
                  )}
                </div>

                {/* 4 Step Mobile Calibration Guide */}
                <div className={styles.qrStepsGuide}>
                  <div className={styles.qrStepItem}>
                    <div className={styles.qrStepNumber}>1</div>
                    <div className={styles.qrStepText}>
                      <h4>Download &amp; Open Presenti Mobile App</h4>
                      <p>
                        Launch the Presenti app on your Android smartphone. Make sure your phone's{" "}
                        <strong>Location (GPS)</strong> toggle is turned ON.
                      </p>
                    </div>
                  </div>

                  <div className={styles.qrStepItem}>
                    <div className={styles.qrStepNumber}>2</div>
                    <div className={styles.qrStepText}>
                      <h4>Sign In with this Administrator Account</h4>
                      <p>
                        Log in on mobile using the same administrator credentials as this web portal:
                      </p>
                      <div className={styles.accountCredentialsBox}>
                        <div className={styles.credRow}>
                          <span className={styles.credLabel}>Admin Email:</span>
                          <span className={styles.credValue}>{user?.email || church?.adminEmail || "Admin Account"}</span>
                          {(user?.email || church?.adminEmail) && (
                            <button
                              type="button"
                              className={styles.credCopyBtn}
                              onClick={() => handleCopyEmail(user?.email || church?.adminEmail || "")}
                              title="Copy Admin Email"
                            >
                              {copiedEmail ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                        <div className={styles.credRow}>
                          <span className={styles.credLabel}>Org Code:</span>
                          <span className={styles.credValueMono}>{church?.churchCode || "ORG"}</span>
                          {church?.churchCode && (
                            <button
                              type="button"
                              className={styles.credCopyBtn}
                              onClick={() => handleCopyCode(church.churchCode)}
                              title="Copy Organization Code"
                            >
                              {copiedCode ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={styles.qrStepItem}>
                    <div className={styles.qrStepNumber}>3</div>
                    <div className={styles.qrStepText}>
                      <h4>Open Admin Command Center → Presence Anchors</h4>
                      <p>
                        Since you are an Administrator, your mobile home screen displays the{" "}
                        <strong>Admin Command Center</strong>. Tap <strong>Presence Anchors</strong> (or scan this QR code directly using the in-app scanner).
                      </p>
                    </div>
                  </div>

                  <div className={styles.qrStepItem}>
                    <div className={styles.qrStepNumber}>4</div>
                    <div className={styles.qrStepText}>
                      <h4>Perform On-Site Hardware Calibration</h4>
                      <p>
                        {selectedMode === "GEOFENCE_ONLY"
                          ? "Your phone locks exact satellite GPS coordinates and perimeter radius with native device accuracy. Tap 'Save Anchors' — this web portal updates live in real time!"
                          : "Connect your phone to your premises Wi-Fi router. The phone hardware captures the router BSSID and GPS. Tap 'Save Anchors' — this web portal updates live in real time!"}
                      </p>
                    </div>
                  </div>

                  {(isWifiConfigured || isGeoConfigured) && (
                    <div style={{ marginTop: "10px" }}>
                      <button
                        type="button"
                        className={styles.restartSessionBtn}
                        onClick={() => setViewMode("OVERVIEW")}
                      >
                        ← Back to Calibrated Overview
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
