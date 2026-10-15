import React, { useState, useEffect } from "react";
import {
  Wifi,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  Radio,
  RefreshCw,
  Edit3,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  QrCode,
  Smartphone,
  Copy,
  Check,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { db } from "../config/firebase";
import { GooglePresenceMap } from "../components/common/GooglePresenceMap";
import { LocationSearchPinpoint } from "../components/common/LocationSearchPinpoint";
import {
  validateSsid,
  validateMacAddress,
  validateCoordinates,
} from "../utils/formValidation";
import styles from "./BeaconSettingsPage.module.css";

const RADIUS_OPTIONS = [10, 20, 30, 40, 50, 80, 100];

export const BeaconSettingsPage: React.FC = () => {
  const { church, updateChurch } = useAuth();

  // Anchors state
  const [ssidHint, setSsidHint] = useState("");
  const [targetBssid, setTargetBssid] = useState("");
  const [latitude, setLatitude] = useState<number>(4.975);
  const [longitude, setLongitude] = useState<number>(8.3417);
  const [radiusMeters, setRadiusMeters] = useState<number>(10);
  const [pinnedLocationName, setPinnedLocationName] = useState<string>("");

  // View state: OVERVIEW (if already calibrated) vs QR_STATION (to calibrate)
  const [viewMode, setViewMode] = useState<"OVERVIEW" | "QR_STATION">(
    "QR_STATION",
  );
  const [hasInitializedView, setHasInitializedView] = useState<boolean>(false);

  // Real-time Calibration Session state
  const [calibrationSession, setCalibrationSession] = useState<{
    status: "AWAITING_SCAN" | "CONNECTED" | "COMPLETED";
    connectedAt?: string;
    completedAt?: string;
    platform?: string;
  }>({ status: "AWAITING_SCAN" });

  // Manual fallback accordion toggle
  const [manualOpen, setManualOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [copiedMac, setCopiedMac] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Browser Geolocation Pickup with graceful desktop fallback
  const handleUseCurrentLocation = () => {
    setIsLocating(true);

    if (!("geolocation" in navigator)) {
      toast.error("Geolocation API is not supported by your browser.");
      setIsLocating(false);
      return;
    }

    const onLocationSuccess = async (position: GeolocationPosition) => {
      const lat = parseFloat(position.coords.latitude.toFixed(6));
      const lng = parseFloat(position.coords.longitude.toFixed(6));
      setLatitude(lat);
      setLongitude(lng);
      setIsLocating(false);
      toast.success(`Current location locked (${lat}, ${lng})!`);

      try {
        const { reverseGeocode } = await import("../services/geocodingService");
        const geo = await reverseGeocode(lat, lng);
        if (geo?.displayName) {
          setPinnedLocationName(geo.displayName);
        }
      } catch {
        // ignore
      }
    };

    const tryFetch = (highAccuracy: boolean) => {
      navigator.geolocation.getCurrentPosition(
        onLocationSuccess,
        (err) => {
          if (highAccuracy && (err.code === 3 || err.code === 2)) {
            // High accuracy timed out on desktop browser: retry with network/IP geolocation
            tryFetch(false);
            return;
          }
          console.warn("Geolocation error:", err);
          const msg =
            err.code === 1
              ? "Location access denied. Please grant permission in browser settings."
              : "Unable to acquire browser location. You can search your address or drag the pin on the map.";
          toast.error(msg);
          setIsLocating(false);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: highAccuracy ? 5000 : 15000,
          maximumAge: 300000,
        },
      );
    };

    tryFetch(true);
  };

  // Initialize data from church profile
  useEffect(() => {
    if (church) {
      const savedSsid = church.beaconConfig?.ssidHint || "";
      const savedBssid = church.beaconConfig?.targetBssid || "";
      const isGeoSet = Boolean(
        church.geoFallback?.isConfigured ??
        (church.geoFallback &&
          church.geoFallback.radiusMeters > 0 &&
          (church.geoFallback.latitude !== 0 ||
            church.geoFallback.longitude !== 0) &&
          Boolean(savedBssid)),
      );
      const savedLat = isGeoSet ? church.geoFallback!.latitude : 4.975;
      const savedLng = isGeoSet ? church.geoFallback!.longitude : 8.3417;
      const savedRadius = isGeoSet ? church.geoFallback!.radiusMeters : 10;
      const savedLabel = church.branchName || church.churchName || "";

      setSsidHint(savedSsid);
      setTargetBssid(savedBssid);
      setLatitude(savedLat);
      setLongitude(savedLng);
      setRadiusMeters(savedRadius);
      setPinnedLocationName(savedLabel);

      if (!hasInitializedView) {
        const isAlreadyCalibrated = Boolean(savedBssid && isGeoSet);
        setViewMode(isAlreadyCalibrated ? "OVERVIEW" : "QR_STATION");
        setHasInitializedView(true);
      }
    }
  }, [church, hasInitializedView]);

  // Real-time Firestore session listener: churches/{churchId}/calibration/session
  useEffect(() => {
    if (!db || !church?.id) return;

    const sessionRef = doc(db, "churches", church.id, "calibration", "session");
    let isInitialMount = true;

    const unsubscribe = onSnapshot(sessionRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data?.status) {
          setCalibrationSession({
            status: data.status,
            connectedAt: data.connectedAt,
            completedAt: data.completedAt,
            platform: data.platform,
          });

          // Only trigger completion toast when actively calibrated via mobile during session
          if (!isInitialMount && data.status === "COMPLETED") {
            toast.success(
              "Premises anchors successfully calibrated via mobile device!",
            );
            setViewMode("OVERVIEW");
          } else if (!isInitialMount && (data.status === "DISCONNECTED" || data.status === "CANCELLED")) {
            toast.info("Mobile device disconnected from calibration session.");
          }
        }
      }
      isInitialMount = false;
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
        const freshBssid = data?.beaconConfig?.targetBssid || "";
        const freshSsid = data?.beaconConfig?.ssidHint || "";
        const freshLat = Number(data?.geoFallback?.latitude ?? 0);
        const freshLng = Number(data?.geoFallback?.longitude ?? 0);
        const freshRadius = Number(data?.geoFallback?.radiusMeters ?? 10);
        const freshIsConfigured = Boolean(
          data?.geoFallback?.isConfigured ||
          (freshBssid && freshLat && freshLng),
        );

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
            isConfigured: freshIsConfigured,
          },
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
    });

    return () => unsubscribe();
  }, [church?.id]);

  // Reset or start new QR calibration session
  const handleStartQrSession = async () => {
    setViewMode("QR_STATION");
    setCalibrationSession({ status: "AWAITING_SCAN" });

    if (db && church?.id) {
      try {
        await setDoc(
          doc(db, "churches", church.id, "calibration", "session"),
          {
            status: "AWAITING_SCAN",
            startedAt: new Date().toISOString(),
          },
          { merge: true },
        );
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

  // Manual save override
  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const ssidVal = validateSsid(ssidHint);
    if (!ssidVal.isValid) {
      toast.error(ssidVal.error);
      return;
    }

    const bssidVal = validateMacAddress(targetBssid);
    if (!bssidVal.isValid) {
      toast.error(bssidVal.error);
      return;
    }

    const coordsVal = validateCoordinates(latitude, longitude);
    if (!coordsVal.isValid) {
      toast.error(coordsVal.error);
      return;
    }

    setIsSavingManual(true);
    try {
      await updateChurch({
        beaconConfig: {
          ssidHint: ssidHint.trim(),
          targetBssid: targetBssid.trim().toLowerCase(),
        },
        geoFallback: {
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radiusMeters),
          isConfigured: true,
        },
      });

      toast.success("Manual presence anchors saved successfully!");
      setViewMode("OVERVIEW");
      setManualOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update manual presence anchors.");
    } finally {
      setIsSavingManual(false);
    }
  };

  // Compact QR Code Payload for instant recognition (<50ms like WhatsApp/Xender)
  const qrPayload = JSON.stringify({
    t: "CAL",
    id: church?.id || "",
    c: church?.churchCode || "ORG",
    n: church?.branchName || church?.churchName || "Organization",
    type: "CALIBRATE_ANCHORS",
    churchId: church?.id || "",
    churchCode: church?.churchCode || "ORG",
  });

  const isWifiConfigured = Boolean(targetBssid && targetBssid.trim() !== "");

  const isGeoConfigured = Boolean(
    (radiusMeters > 0 && (latitude !== 0 || longitude !== 0)) ||
    Boolean(church?.geoFallback?.isConfigured),
  );

  return (
    <div className={styles.pageContainer}>
      {/* Header Section */}
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.headerTitle}>Premises Presence Anchors</h1>
          <p className={styles.headerSubtitle}>
            Calibrate physical premises verification boundaries. Pair with your
            smartphone to detect hardware Wi-Fi radio airwaves and satellite
            coordinates.
          </p>
        </div>
      </div>

      {/* Dual Redundancy Architecture Callout */}
      <div className={styles.systemArchitectureBanner}>
        <Radio size={24} color="#2563EB" style={{ flexShrink: 0 }} />
        <div className={styles.systemArchitectureText}>
          <strong>Dual-Anchor Redundancy:</strong> Worker clock-ins first
          authenticate via physical router radio hardware (Section A). If the
          premises router is offline, the mobile app automatically transitions
          to verifying attendance against the{" "}
          <strong>Geofence Perimeter</strong> in Section B within a{" "}
          <strong>20–30s timeout</strong>.
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
                  <h3>Dual Presence Anchors Active &amp; Synchronized</h3>
                  <span className={styles.activeStatusBadge}>
                    <span className={styles.activeStatusDot} /> Live Cloud Sync
                  </span>
                </div>
                <p className={styles.collapsedHeaderSub}>
                  Workers verify attendance against the premises router BSSID
                  with automated GPS geofence failover.
                </p>
              </div>
            </div>

            <button
              type="button"
              className={styles.recalibrateActionBtn}
              onClick={handleStartQrSession}
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
                  >
                    <Wifi size={20} />
                  </div>
                  <div>
                    <h4>Section A — Premises Wi-Fi Anchor</h4>
                    <span>Hardware Radio Presence</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.editCardBtn}
                  onClick={handleStartQrSession}
                  title="Re-calibrate router"
                >
                  <Edit3 size={13} />
                  <span>Re-scan Router</span>
                </button>
              </div>

              <div className={styles.summaryDataRows}>
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
                    Primary · 20–30s Timeout
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
                    <span>Calibrated Fail-Safe Perimeter</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.editCardBtn}
                  onClick={handleStartQrSession}
                  title="Re-calibrate geofence"
                >
                  <Edit3 size={13} />
                  <span>Re-pin Venue</span>
                </button>
              </div>

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
                  <span className={styles.summaryDataLabel}>Failover Rule</span>
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
                        <CheckCircle2 size={14} /> Active on 20–30s Timeout
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} /> Unconfigured · Scan QR
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
                Your smartphone ({calibrationSession.platform || "Device"}) is
                currently linked. Please search or select your premises Wi-Fi
                router and confirm GPS coordinates on your phone, then tap{" "}
                <strong>Save &amp; Sync to Web Portal</strong>.
              </p>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 16px",
                  borderRadius: "999px",
                  backgroundColor: "#E0F2FE",
                  color: "#0369A1",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={14} className="spinner" />
                <span>Awaiting premises coordinates from mobile device...</span>
              </div>
              <button
                type="button"
                className={styles.restartSessionBtn}
                onClick={handleStartQrSession}
              >
                Show QR Code Again
              </button>
            </div>
          ) : (
            /* Real-time Substate B: Awaiting Mobile Camera Scan */
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 8,
                    padding: "6px 12px",
                    borderRadius: 8,
                    backgroundColor: "#FEF3C7",
                    border: "1px solid #FCD34D",
                    color: "#92400E",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                  }}
                >
                  <Wifi size={14} color="#D97706" />
                  <span>Phone Wi-Fi &amp; GPS must be ON to scan networks</span>
                </div>
              </div>

              {/* 3 Step Guide */}
              <div className={styles.qrStepsGuide}>
                <div className={styles.qrStepItem}>
                  <div className={styles.qrStepNumber}>1</div>
                  <div className={styles.qrStepText}>
                    <h4>Turn ON Wi-Fi &amp; GPS, then Open App</h4>
                    <p>
                      On your smartphone, swipe down and ensure both <strong>Wi-Fi</strong> and <strong>Location (GPS)</strong> are toggled <strong>ON</strong>. Then open the Presenti app.
                    </p>
                  </div>
                </div>

                <div className={styles.qrStepItem}>
                  <div className={styles.qrStepNumber}>2</div>
                  <div className={styles.qrStepText}>
                    <h4>Press &amp; Hold the Logo for 5 Seconds</h4>
                    <p>
                      On the mobile sign-in / welcome screen, press and hold the{" "}
                      <strong>Presenti Logo</strong> for 5 seconds. The device will vibrate and instantly launch the{" "}
                      <strong>Calibration QR Scanner</strong>.
                    </p>
                    <p
                      style={{
                        marginTop: 4,
                        fontSize: "0.8rem",
                        color: "#64748B",
                      }}
                    >
                      <em>
                        Secret admin gesture — completely invisible to regular workers for security.
                        (If already signed in, you can also press and hold the header logo on the dashboard).
                      </em>
                    </p>
                  </div>
                </div>

                <div className={styles.qrStepItem}>
                  <div className={styles.qrStepNumber}>3</div>
                  <div className={styles.qrStepText}>
                    <h4>Point Camera at this QR Code</h4>
                    <p>
                      Scan the QR code on your computer screen. The phone will
                      instantly detect nearby physical Wi-Fi radios and acquire
                      high-accuracy GPS coordinates!
                    </p>
                  </div>
                </div>

                {isWifiConfigured && (
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
          )}
        </div>
      )}

      {/* ====================================================================
          COLLAPSED MANUAL INPUT OVERRIDE (Desktop Fallback)
          ==================================================================== */}
      <div className={styles.manualAccordionBox}>
        <button
          type="button"
          className={styles.manualAccordionHeader}
          onClick={() => setManualOpen(!manualOpen)}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: "1rem" }}>⚙️</span>
            <span>Advanced: Manual Input Override (Desktop Fallback)</span>
          </div>
          {manualOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {manualOpen && (
          <form
            onSubmit={handleSaveManual}
            className={styles.manualAccordionBody}
          >
            <p style={{ margin: 0, fontSize: "0.825rem", color: "#64748B" }}>
              Use this form only if mobile QR pairing is not possible. You can
              manually enter the router SSID and hardware BSSID (MAC), and
              pinpoint coordinates using the satellite map.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "20px",
              }}
            >
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Premises Router SSID Label *
                </label>
                <input
                  type="text"
                  value={ssidHint}
                  onChange={(e) => setSsidHint(e.target.value)}
                  placeholder="e.g. Office_Main_5G"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                  }}
                />
              </div>

              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  Hardware BSSID (MAC Address) *
                </label>
                <input
                  type="text"
                  value={targetBssid}
                  onChange={(e) => setTargetBssid(e.target.value)}
                  placeholder="e.g. 0c:61:f9:65:8f:07"
                  className="mono"
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.875rem",
                  }}
                />
              </div>
            </div>

            {/* Manual Pinpoint on Satellite Map */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 8,
                }}
              >
                Geofence Centerpoint &amp; Allowed Boundary
              </label>
              <LocationSearchPinpoint
                currentLat={latitude}
                currentLng={longitude}
                locationLabel={pinnedLocationName}
                isLocating={isLocating}
                onUseCurrentLocation={handleUseCurrentLocation}
                onCoordinatesChange={(lat, lng, label) => {
                  setLatitude(lat);
                  setLongitude(lng);
                  if (label) setPinnedLocationName(label);
                }}
              />
              <div
                style={{ marginTop: 12, borderRadius: 10, overflow: "hidden" }}
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
                  onCoordinatesChange={(lat, lng) => {
                    setLatitude(lat);
                    setLongitude(lng);
                  }}
                  height={240}
                />
              </div>
            </div>

            {/* Radius options */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 8,
                }}
              >
                Allowed Geofence Perimeter: {radiusMeters}m radius (
                {radiusMeters * 2}m diameter)
              </label>
              <div className={styles.radiusSelector}>
                {RADIUS_OPTIONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    className={`${styles.radiusOption} ${radiusMeters === r ? styles.radiusOptionActive : ""}`}
                    onClick={() => setRadiusMeters(r)}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}
            >
              <button
                type="button"
                className={styles.cancelEditBtn}
                onClick={() => setManualOpen(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSavingManual}
                className={styles.editMainBtn}
              >
                <Save size={16} />
                <span>
                  {isSavingManual ? "Saving..." : "Save Manual Anchors"}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
