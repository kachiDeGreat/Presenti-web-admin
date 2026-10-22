import React, { useState, useEffect } from "react";
import {
  Wifi,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Copy,
  Check,
  Compass,
  Layers,
  Zap,
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
  const approxAreaSqm = Math.round(Math.PI * radiusMeters * radiusMeters);

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
      {/* ====================================================================
          TOP HERO COMMAND BAR
          ==================================================================== */}
      <div className={styles.heroCommandBar}>
        <div className={styles.heroCommandLeft}>
          <div className={styles.heroTagRow}>
            <span className={styles.heroMicroTag}>HARDWARE PRESENCE &amp; TELEMETRY</span>
            <div
              className={styles.statusPillBadge}
              style={{
                backgroundColor: isCalibratedLive ? "#ECFDF5" : "#FFFBEB",
                borderColor: isCalibratedLive ? "#A7F3D0" : "#FDE68A",
              }}
            >
              <div
                className={styles.pulseDot}
                style={{ backgroundColor: isCalibratedLive ? "#10B981" : "#F59E0B" }}
              />
              <span
                style={{
                  color: isCalibratedLive ? "#047857" : "#B45309",
                  fontWeight: 700,
                  fontSize: "0.75rem",
                  letterSpacing: "0.04em",
                }}
              >
                {isCalibratedLive ? "LIVE CLOUD SYNCHRONIZED" : "PENDING MOBILE CALIBRATION"}
              </span>
            </div>
          </div>

          <h1 className={styles.heroTitle}>Premises Presence Anchors</h1>
          <p className={styles.heroSubtitle}>
            Physical verification boundary for workforce clock-ins. Anchors are calibrated on-site via smartphone sensors and auto-sync in real time.
          </p>
        </div>

        <div className={styles.heroCommandRight}>
          <div className={styles.quickModeCard}>
            <div className={styles.quickModeIconBox}>
              {isGeofenceOnly ? <Compass size={18} color="#2563EB" /> : <Wifi size={18} color="#2563EB" />}
            </div>
            <div>
              <div className={styles.quickModeLabel}>ACTIVE ARCHITECTURE</div>
              <div className={styles.quickModeVal}>
                {isGeofenceOnly ? "Satellite GPS Geofence" : "Hybrid Router + GPS"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          4 TELEMETRY METRIC STAT CARDS
          ==================================================================== */}
      <div className={styles.metricsGrid}>
        {/* Card 1: Architecture Mode */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>VERIFICATION MODE</span>
            <div className={styles.metricIconWrap}>
              {isGeofenceOnly ? <Compass size={16} color="#2563EB" /> : <Wifi size={16} color="#2563EB" />}
            </div>
          </div>
          <div className={styles.metricMainVal}>
            {isGeofenceOnly ? "Router-Free" : "Hybrid Dual-Tier"}
          </div>
          <div className={styles.metricSubText}>
            {isGeofenceOnly
              ? "High-precision GPS satellite boundary"
              : "Router MAC + GPS perimeter fallback"}
          </div>
        </div>

        {/* Card 2: GPS Coordinates */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>CENTERPOINT COORDINATES</span>
            <button
              type="button"
              className={styles.metricCopyBtn}
              onClick={handleCopyCoords}
              title="Copy Coordinates"
            >
              {copiedCoords ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
            </button>
          </div>
          <div className={styles.metricMainValMono}>
            {latitude && longitude
              ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
              : "0.000000, 0.000000"}
          </div>
          <div className={styles.metricSubText} title={pinnedLocationName}>
            {pinnedLocationName || "Calabar, Cross River, Nigeria"}
          </div>
        </div>

        {/* Card 3: Perimeter Radius */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>GEOFENCE RADIUS</span>
            <div className={styles.metricIconWrap}>
              <Layers size={16} color="#059669" />
            </div>
          </div>
          <div className={styles.metricMainVal}>
            {radiusMeters}m <span className={styles.metricUnit}>radius</span>
          </div>
          <div className={styles.metricSubText}>
            {radiusMeters * 2}m diameter • ~{approxAreaSqm.toLocaleString()} m² coverage
          </div>
        </div>

        {/* Card 4: Hardware Router MAC or Device Lock */}
        <div className={styles.metricCard}>
          <div className={styles.metricHeader}>
            <span className={styles.metricLabel}>
              {isGeofenceOnly ? "SECURITY ENFORCEMENT" : "ROUTER BSSID (MAC)"}
            </span>
            {!isGeofenceOnly && targetBssid && (
              <button
                type="button"
                className={styles.metricCopyBtn}
                onClick={handleCopyMac}
                title="Copy MAC"
              >
                {copiedMac ? <Check size={12} color="#10B981" /> : <Copy size={12} />}
              </button>
            )}
          </div>
          <div className={isGeofenceOnly ? styles.metricMainVal : styles.metricMainValMono}>
            {isGeofenceOnly ? "Hardware-Isolated" : targetBssid || "Configured on Mobile"}
          </div>
          <div className={styles.metricSubText}>
            {isGeofenceOnly
              ? "Zero proxy • Bound to worker phone hardware"
              : ssidHint ? `Network: ${ssidHint}` : "Office Router Anchor"}
          </div>
        </div>
      </div>

      {/* ====================================================================
          EXECUTIVE 2-COLUMN WORKSTATION
          Left: Interactive Presence Radar Console
          Right: On-Site Mobile Calibration Guide
          ==================================================================== */}
      <div className={styles.workstationLayout}>
        {/* LEFT COLUMN: PRESENCE RADAR CONSOLE */}
        <div className={styles.radarConsoleCard}>
          <div className={styles.radarConsoleHeader}>
            <div className={styles.radarTitleGroup}>
              <div className={styles.radarLiveBadge}>
                <div className={styles.radarPulseDot} />
                <span>RADAR TELEMETRY</span>
              </div>
              <h3 className={styles.radarConsoleTitle}>Live Calibrated Premises Map</h3>
            </div>
            <div className={styles.radarMetaPills}>
              <span className={styles.radarCoordChip}>
                <MapPin size={12} color="#2563EB" />
                {latitude.toFixed(4)}, {longitude.toFixed(4)}
              </span>
              <span className={styles.radarRadiusChip}>
                Ø {radiusMeters * 2}m Perimeter
              </span>
            </div>
          </div>

          <div className={styles.radarMapFrame}>
            <GooglePresenceMap
              latitude={latitude}
              longitude={longitude}
              radiusMeters={radiusMeters}
              locationLabel={pinnedLocationName || church?.branchName || church?.churchName || "Premises Centerpoint"}
              height={380}
            />
          </div>

          <div className={styles.radarConsoleFooter}>
            <div className={styles.radarFooterItem}>
              <ShieldCheck size={15} color="#059669" />
              <span>Workers must be physically within the highlighted circle to log attendance.</span>
            </div>
            <div className={styles.radarCoverageBadge}>
              Active Geofence: {radiusMeters}m
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: MOBILE CALIBRATION GUIDE */}
        <div className={styles.mobileCalibrationCard}>
          <div className={styles.calibCardHeader}>
            <div className={styles.calibIconCircle}>
              <Smartphone size={22} color="#2563EB" />
            </div>
            <div>
              <h3 className={styles.calibCardTitle}>On-Site Mobile Calibration</h3>
              <p className={styles.calibCardSub}>
                Wi-Fi airwaves &amp; GNSS satellite telemetry require physical smartphone hardware.
              </p>
            </div>
          </div>

          {/* Stepper Timeline */}
          <div className={styles.stepperContainer}>
            {/* Step 1 */}
            <div className={styles.stepperItem}>
              <div className={styles.stepperMarker}>
                <div className={styles.stepperNumber}>1</div>
                <div className={styles.stepperLine} />
              </div>
              <div className={styles.stepperBody}>
                <h4 className={styles.stepHeading}>Open Presenti Mobile App</h4>
                <p className={styles.stepDesc}>
                  Launch the app on your Android phone with <strong>Location (GPS)</strong> turned ON.
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className={styles.stepperItem}>
              <div className={styles.stepperMarker}>
                <div className={styles.stepperNumber}>2</div>
                <div className={styles.stepperLine} />
              </div>
              <div className={styles.stepperBody}>
                <h4 className={styles.stepHeading}>Sign In with Admin Account</h4>
                <p className={styles.stepDesc}>
                  Log into the phone using your administrator credentials:
                </p>

                {/* Sleek Developer Credentials Token Card */}
                <div className={styles.tokenCard}>
                  <div className={styles.tokenRow}>
                    <div className={styles.tokenCol}>
                      <span className={styles.tokenKey}>ADMIN EMAIL</span>
                      <span className={styles.tokenVal}>
                        {user?.email || church?.adminEmail || "admin@presenti.app"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.tokenCopyBtn}
                      onClick={() => handleCopyEmail(user?.email || church?.adminEmail || "")}
                      title="Copy Email"
                    >
                      {copiedEmail ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                    </button>
                  </div>

                  <div className={styles.tokenDivider} />

                  <div className={styles.tokenRow}>
                    <div className={styles.tokenCol}>
                      <span className={styles.tokenKey}>ORGANIZATION CODE</span>
                      <span className={styles.tokenValMono}>
                        {church?.churchCode || "KW-RTX-482"}
                      </span>
                    </div>
                    <button
                      type="button"
                      className={styles.tokenCopyBtn}
                      onClick={() => handleCopyCode(church?.churchCode || "")}
                      title="Copy Code"
                    >
                      {copiedCode ? <Check size={13} color="#10B981" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className={styles.stepperItem}>
              <div className={styles.stepperMarker}>
                <div className={styles.stepperNumber}>3</div>
                <div className={styles.stepperLine} />
              </div>
              <div className={styles.stepperBody}>
                <h4 className={styles.stepHeading}>Tap "Presence Anchors" Tab</h4>
                <p className={styles.stepDesc}>
                  Switch to the Anchors tab in the Mobile Command Center to calibrate on-site.
                </p>
              </div>
            </div>

            {/* Step 4 */}
            <div className={styles.stepperItem}>
              <div className={styles.stepperMarker}>
                <div className={styles.stepperNumber}>4</div>
              </div>
              <div className={styles.stepperBody}>
                <h4 className={styles.stepHeading}>Pinpoint GPS &amp; Save</h4>
                <p className={styles.stepDesc}>
                  Select your mode (Geofence or Router), tap <strong>"Pinpoint Current GPS"</strong>, choose your radius, and tap <strong>"Save Calibrated Anchors"</strong>.
                </p>
              </div>
            </div>
          </div>

          {/* Glowing Auto-Sync Box */}
          <div className={styles.cloudSyncBanner}>
            <div className={styles.syncGlowDot} />
            <div style={{ flex: 1 }}>
              <div className={styles.syncBannerTitle}>Instant Cloud Auto-Sync</div>
              <div className={styles.syncBannerText}>
                Any updates committed on your phone sync here in real time via Cloud Firestore. If you move offices or change routers, simply recalibrate on your phone!
              </div>
            </div>
            <Zap size={18} color="#2563EB" style={{ flexShrink: 0 }} />
          </div>
        </div>
      </div>
    </div>
  );
};
