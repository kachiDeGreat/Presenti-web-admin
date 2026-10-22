import React, { useState, useEffect } from "react";
import {
  Wifi,
  MapPin,
  AlertTriangle,
  Radio,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import { doc, onSnapshot } from "firebase/firestore";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import { GooglePresenceMap } from "../components/common/GooglePresenceMap";
import { reverseGeocode } from "../services/geocodingService";
import styles from "./BeaconSettingsPage.module.css";

export const BeaconSettingsPage: React.FC = () => {
  const { user, church } = useAuth();

  // Synchronous initial state from church context
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

  const [ssidHint, setSsidHint] = useState<string>(() => (isInitiallyCalibrated ? church?.beaconConfig?.ssidHint || "" : ""));
  const [targetBssid, setTargetBssid] = useState<string>(() => (isInitiallyCalibrated ? church?.beaconConfig?.targetBssid || "" : ""));
  const [latitude, setLatitude] = useState<number>(() => (isInitiallyCalibrated ? Number(church?.geoFallback?.latitude ?? 4.975) : 4.975));
  const [longitude, setLongitude] = useState<number>(() => (isInitiallyCalibrated ? Number(church?.geoFallback?.longitude ?? 8.3417) : 8.3417));
  const [radiusMeters, setRadiusMeters] = useState<number>(() => (isInitiallyCalibrated ? Number(church?.geoFallback?.radiusMeters ?? 20) : 20));
  const [verificationMode, setVerificationMode] = useState<"HYBRID" | "GEOFENCE_ONLY">(initialMode);
  const [pinnedLocationName, setPinnedLocationName] = useState<string>(() => (isInitiallyCalibrated ? church?.branchName || church?.churchName || "" : ""));
  const [isCalibratedLive, setIsCalibratedLive] = useState<boolean>(() => isInitiallyCalibrated);
  const [isDataMounted, setIsDataMounted] = useState<boolean>(false);

  // Copy helpers
  const [copiedMac, setCopiedMac] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedCoords, setCopiedCoords] = useState(false);

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

  const handleCopyCoords = () => {
    if (!latitude || !longitude) return;
    navigator.clipboard.writeText(`${latitude.toFixed(6)}, ${longitude.toFixed(6)}`);
    setCopiedCoords(true);
    toast.success("Coordinates copied to clipboard!");
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleCopyMac = () => {
    if (!targetBssid) return;
    navigator.clipboard.writeText(targetBssid);
    setCopiedMac(true);
    toast.success("Router BSSID copied to clipboard!");
    setTimeout(() => setCopiedMac(false), 2000);
  };

  // Synchronous mount
  useEffect(() => {
    if (church) {
      const isExplicit = Boolean(
        church.isCalibrated ||
        church.geoFallback?.isCalibrated ||
        (church.geoFallback?.isConfigured &&
          (church.beaconConfig?.targetBssid ||
            church.beaconConfig?.verificationMode === "GEOFENCE_ONLY")) ||
        (Number(church.geoFallback?.latitude ?? 0) !== 0 &&
          Number(church.geoFallback?.longitude ?? 0) !== 0)
      );

      if (isExplicit) setIsCalibratedLive(true);
      if (church.beaconConfig?.ssidHint) setSsidHint(church.beaconConfig.ssidHint);
      if (church.beaconConfig?.targetBssid) setTargetBssid(church.beaconConfig.targetBssid);
      if (church.beaconConfig?.verificationMode) setVerificationMode(church.beaconConfig.verificationMode);
      if (church.geoFallback?.latitude) setLatitude(Number(church.geoFallback.latitude));
      if (church.geoFallback?.longitude) setLongitude(Number(church.geoFallback.longitude));
      if (church.geoFallback?.radiusMeters) setRadiusMeters(Number(church.geoFallback.radiusMeters));

      setIsDataMounted(true);
    }
  }, [church]);

  // Real-time Firestore church listener: updates web portal immediately when mobile commits
  useEffect(() => {
    if (!db || !church?.id) return;

    const churchRef = doc(db, "churches", church.id);
    const unsubscribe = onSnapshot(churchRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();

        const freshBssid = data?.beaconConfig?.targetBssid || "";
        const freshSsid = data?.beaconConfig?.ssidHint || "";
        const freshMode = data?.beaconConfig?.verificationMode || (freshBssid ? "HYBRID" : "GEOFENCE_ONLY");
        const freshLat = Number(data?.geoFallback?.latitude ?? 0);
        const freshLng = Number(data?.geoFallback?.longitude ?? 0);
        const freshRadius = Number(data?.geoFallback?.radiusMeters ?? 20);

        const isExplicit = Boolean(
          data?.isCalibrated ||
          data?.geoFallback?.isCalibrated ||
          (data?.geoFallback?.isConfigured &&
            (freshBssid || freshMode === "GEOFENCE_ONLY")) ||
          (freshLat !== 0 && freshLng !== 0)
        );

        if (isExplicit) {
          setIsCalibratedLive(true);
          setVerificationMode(freshMode);
          if (freshBssid) setTargetBssid(freshBssid);
          if (freshSsid) setSsidHint(freshSsid);
          if (freshLat && freshLng) {
            setLatitude(freshLat);
            setLongitude(freshLng);
            setRadiusMeters(freshRadius);

            reverseGeocode(freshLat, freshLng)
              .then((geo) => {
                if (geo?.displayName) setPinnedLocationName(geo.displayName);
              })
              .catch(() => {});
          }
        }
      }
    }, (err) => {
      console.warn("Church snapshot error:", err);
    });

    return () => unsubscribe();
  }, [church?.id]);

  const isGeofenceOnly = verificationMode === "GEOFENCE_ONLY" || (!targetBssid && isCalibratedLive);

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
          <div className="section-tag">// PHYSICAL PRESENCE & GEOFENCE TELEMETRY</div>
          <h1 className={styles.headerTitle}>Premises Presence Anchors</h1>
          <p className={styles.headerSubtitle}>
            Physical verification perimeter for worker clock-ins. Anchors are calibrated on-site using the Presenti Mobile App and automatically synchronize here in real time.
          </p>
        </div>
      </div>

      {/* Dynamic Architecture Callout Banner */}
      <div className={styles.systemArchitectureBanner}>
        <Radio size={20} color="var(--brand-primary)" style={{ flexShrink: 0 }} />
        <div className={styles.systemArchitectureText}>
          {isGeofenceOnly ? (
            <>
              <strong>Satellite GPS Geofence Mode (Router-Free · Active):</strong> Worker attendance authenticates via high-precision satellite GPS coordinates (<strong style={{ color: "#059669" }}>instant clock-in</strong>). Zero router hardware is required.
            </>
          ) : (
            <>
              <strong>Hybrid Wi-Fi Router + GPS Mode (Active):</strong> Worker attendance authenticates by detecting your office router's physical MAC address (BSSID), with automatic failover to the satellite GPS perimeter.
            </>
          )}
        </div>
      </div>

      {/* ====================================================================
          CURRENT CALIBRATED STATUS & MAP OVERVIEW
          ==================================================================== */}
      <div className={styles.collapsedContainer}>
        {/* Status Header Banner */}
        <div className={styles.collapsedHeaderCard}>
          <div className={styles.collapsedHeaderLeft}>
            <div
              className={styles.calibratedShieldIcon}
              style={{
                backgroundColor: isCalibratedLive ? "#ECFDF5" : "#FFFBEB",
                color: isCalibratedLive ? "#059669" : "#D97706",
              }}
            >
              {isCalibratedLive ? <ShieldCheck size={26} /> : <AlertTriangle size={26} />}
            </div>
            <div className={styles.collapsedHeaderTexts}>
              <div className={styles.collapsedHeaderTitleRow}>
                <h3>
                  {isCalibratedLive
                    ? isGeofenceOnly
                      ? "Satellite GPS Presence Anchor Active"
                      : "Hybrid Router + GPS Presence Anchors Active"
                    : "Presence Anchors Pending Calibration"}
                </h3>
                <span
                  className={styles.activeStatusBadge}
                  style={{
                    backgroundColor: isCalibratedLive ? "#ECFDF5" : "#FFFBEB",
                    color: isCalibratedLive ? "#059669" : "#D97706",
                    borderColor: isCalibratedLive ? "#A7F3D0" : "#FDE68A",
                  }}
                >
                  <span
                    className={styles.activeStatusDot}
                    style={{ backgroundColor: isCalibratedLive ? "#10B981" : "#F59E0B" }}
                  />{" "}
                  {isCalibratedLive ? "Live Cloud Synchronized" : "Action Required on Mobile"}
                </span>
              </div>
              <p className={styles.collapsedHeaderSub}>
                {isCalibratedLive
                  ? isGeofenceOnly
                    ? "Workers authenticate attendance against the high-accuracy satellite GPS geofence boundary."
                    : "Workers authenticate attendance against premises router radio airwaves with GPS perimeter backup."
                  : "Calibrate your premises anchors using the Presenti Mobile App on your smartphone to activate attendance."}
              </p>
            </div>
          </div>
        </div>

        {/* Data Cards Grid */}
        <div className={styles.collapsedSummaryGrid}>
          {/* Section A: Wi-Fi Anchor Card */}
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
                  <h4>Section A — Premises Router Anchor</h4>
                  <span>Hardware Wi-Fi Airwave Radio</span>
                </div>
              </div>
            </div>

            <div className={styles.summaryDataRows}>
              <div className={styles.summaryDataRow}>
                <span className={styles.summaryDataLabel}>Verification Mode</span>
                <span className={styles.summaryDataValue}>
                  {isGeofenceOnly ? "Router-Free (GPS Geofence Only)" : "Hybrid (Router + GPS)"}
                </span>
              </div>
              <div className={styles.summaryDataRow}>
                <span className={styles.summaryDataLabel}>Router SSID (Name)</span>
                <span className={styles.summaryDataValue}>
                  {isGeofenceOnly ? "Not Applicable" : ssidHint || "Configured on Mobile"}
                </span>
              </div>
              <div className={styles.summaryDataRow}>
                <span className={styles.summaryDataLabel}>Hardware MAC (BSSID)</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span
                    className={styles.summaryDataValueMono}
                    style={isGeofenceOnly ? { color: "#94A3B8" } : undefined}
                  >
                    {isGeofenceOnly ? "Not Required" : targetBssid || "Configured on Mobile"}
                  </span>
                  {!isGeofenceOnly && targetBssid && (
                    <button
                      type="button"
                      className={styles.credCopyBtn}
                      onClick={handleCopyMac}
                      title="Copy BSSID"
                    >
                      {copiedMac ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section B: Geofence Perimeter Card */}
          <div className={styles.summaryCard}>
            <div className={styles.summaryCardHeader}>
              <div className={styles.summaryCardTitleGroup}>
                <div className={`${styles.summaryCardIcon} ${styles.iconPin}`}>
                  <MapPin size={20} />
                </div>
                <div>
                  <h4>Section B — GPS Geofence Perimeter</h4>
                  <span>Satellite Coordinate Boundary</span>
                </div>
              </div>
            </div>

            <div className={styles.summaryDataRows}>
              <div className={styles.summaryDataRow}>
                <span className={styles.summaryDataLabel}>GPS Coordinates</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className={styles.summaryDataValueMono}>
                    {latitude && longitude
                      ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                      : "Pending Mobile Sampling"}
                  </span>
                  {latitude && longitude && (
                    <button
                      type="button"
                      className={styles.credCopyBtn}
                      onClick={handleCopyCoords}
                      title="Copy Coordinates"
                    >
                      {copiedCoords ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.summaryDataRow}>
                <span className={styles.summaryDataLabel}>Perimeter Radius</span>
                <span className={styles.summaryDataValue}>
                  {radiusMeters} meters{" "}
                  <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>
                    ({radiusMeters <= 20 ? "Compact Suite" : radiusMeters <= 50 ? "Venue / Hall" : "Campus Grounds"})
                  </span>
                </span>
              </div>
              {pinnedLocationName && (
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>Venue Address</span>
                  <span className={styles.summaryDataValue} style={{ maxWidth: 220 }} title={pinnedLocationName}>
                    {pinnedLocationName}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Live Interactive Presence Map Preview */}
        <div className={styles.collapsedMapContainer}>
          <div className={styles.collapsedMapHeader}>
            <div className={styles.collapsedMapHeaderLeft}>
              <MapPin size={18} color="#2563EB" />
              <div>
                <h4>Live Calibrated Premises Map</h4>
                <p>
                  Workers must be within the highlighted circle ({radiusMeters}m radius) to successfully clock in.
                </p>
              </div>
            </div>
          </div>

          <GooglePresenceMap
            latitude={latitude}
            longitude={longitude}
            radiusMeters={radiusMeters}
            locationLabel={pinnedLocationName || church?.branchName || church?.churchName || "Premises"}
            height="280px"
          />
        </div>
      </div>

      {/* ====================================================================
          HOW TO CALIBRATE OR UPDATE ON MOBILE (GUIDE PANEL)
          ==================================================================== */}
      <div className={styles.mobileGuideCard}>
        <div className={styles.mobileGuideHeader}>
          <div className={styles.mobileGuideIconCircle}>
            <Smartphone size={24} color="#2563EB" />
          </div>
          <div>
            <h3 className={styles.mobileGuideTitle}>How to Calibrate or Update Presence Anchors</h3>
            <p className={styles.mobileGuideSubtitle}>
              Hardware-isolated sensors (Wi-Fi router airwaves and high-precision satellite GNSS) run exclusively on your physical smartphone. To calibrate or change presence anchors, follow these steps on your mobile phone:
            </p>
          </div>
        </div>

        <div className={styles.guideStepsGrid}>
          {/* Step 1 */}
          <div className={styles.guideStepBox}>
            <div className={styles.guideStepNumberBadge}>1</div>
            <div className={styles.guideStepContent}>
              <h4>Open Presenti Mobile App</h4>
              <p>
                Launch the Presenti app on your smartphone and ensure your device <strong>Location (GPS)</strong> is turned ON.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className={styles.guideStepBox}>
            <div className={styles.guideStepNumberBadge}>2</div>
            <div className={styles.guideStepContent}>
              <h4>Log In as Administrator</h4>
              <p>
                Sign in using your administrator account credentials.
              </p>
              <div className={styles.guideCredBox}>
                <div className={styles.guideCredRow}>
                  <span className={styles.guideCredLabel}>Admin:</span>
                  <span className={styles.guideCredVal}>{user?.email || church?.adminEmail || "Admin Email"}</span>
                  {(user?.email || church?.adminEmail) && (
                    <button
                      type="button"
                      className={styles.credCopyBtn}
                      onClick={() => handleCopyEmail(user?.email || church?.adminEmail || "")}
                      title="Copy Email"
                    >
                      {copiedEmail ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
                <div className={styles.guideCredRow}>
                  <span className={styles.guideCredLabel}>Org Code:</span>
                  <span className={styles.guideCredValMono}>{church?.churchCode || "ORG"}</span>
                  {church?.churchCode && (
                    <button
                      type="button"
                      className={styles.credCopyBtn}
                      onClick={() => handleCopyCode(church.churchCode)}
                      title="Copy Code"
                    >
                      {copiedCode ? <Check size={11} color="#10B981" /> : <Copy size={11} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className={styles.guideStepBox}>
            <div className={styles.guideStepNumberBadge}>3</div>
            <div className={styles.guideStepContent}>
              <h4>Go to "Presence Anchors" Tab</h4>
              <p>
                In the Mobile Admin Command Center, tap the <strong>Presence Anchors</strong> tab to access the on-site calibration engine.
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className={styles.guideStepBox}>
            <div className={styles.guideStepNumberBadge}>4</div>
            <div className={styles.guideStepContent}>
              <h4>Calibrate On-Site &amp; Save</h4>
              <p>
                Select <strong>Satellite Geofence</strong> or <strong>Router + Geofence</strong>, tap <strong>"Pinpoint Current GPS"</strong> (and scan your office Wi-Fi if using a router), adjust your perimeter radius, and tap <strong>"Save Calibrated Anchors"</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Real-time Sync Note */}
        <div className={styles.autoSyncNoticeRow}>
          <div className={styles.autoSyncDot} />
          <p className={styles.autoSyncNoticeText}>
            <strong>Instant Cloud Auto-Sync:</strong> Any calibration or changes made on your mobile phone are committed to Cloud Firestore and synchronize with this web portal immediately. Whenever you relocate offices or replace routers, simply recalibrate on your phone!
          </p>
        </div>
      </div>
    </div>
  );
};
