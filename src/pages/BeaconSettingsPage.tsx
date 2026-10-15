import React, { useState, useEffect } from "react";
import {
  Wifi,
  MapPin,
  Save,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Radio,
  Lock,
  RefreshCw,
  Check,
  Edit3,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../context/AuthContext";
import { GooglePresenceMap } from "../components/common/GooglePresenceMap";
import { LocationSearchPinpoint } from "../components/common/LocationSearchPinpoint";
import {
  validateSsid,
  validateMacAddress,
  validateCoordinates,
} from "../utils/formValidation";
import styles from "./BeaconSettingsPage.module.css";

interface ScannedWifi {
  inUse: boolean;
  ssid: string;
  bssid: string;
  signal: string;
  bars: string;
  security: string;
  band: string;
  channel: number;
}

const RADIUS_OPTIONS = [10, 20, 30, 40, 50, 80, 100];

export const BeaconSettingsPage: React.FC = () => {
  const { church, updateChurch } = useAuth();

  // Tier 1: Hardware Anchor (Wi-Fi)
  const [ssidHint, setSsidHint] = useState("");
  const [targetBssid, setTargetBssid] = useState("");

  // Real Wi-Fi Network Scanning
  const [availableNetworks, setAvailableNetworks] = useState<ScannedWifi[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerUnavailable, setScannerUnavailable] = useState(false);
  const [showManualWifi, setShowManualWifi] = useState(false);

  // Tier 2: Geolocation Anchor (Google Maps & Satellite)
  const [latitude, setLatitude] = useState<number>(4.975);
  const [longitude, setLongitude] = useState<number>(8.3417);
  const [radiusMeters, setRadiusMeters] = useState<number>(10); // User requested 10m default
  const [pinnedLocationName, setPinnedLocationName] = useState<string>("");

  const [locating, setLocating] = useState(false);
  const [locatingError, setLocatingError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Collapsed vs Edit mode state
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [hasInitializedCollapse, setHasInitializedCollapse] =
    useState<boolean>(false);

  // Individual card accordion toggles (for editing mode)
  const [sectionAOpen, setSectionAOpen] = useState<boolean>(true);
  const [sectionBOpen, setSectionBOpen] = useState<boolean>(true);

  // Fetch real physical Wi-Fi scan from local system (available in local dev mode via Vite)
  const scanRealWifi = async () => {
    setIsScanning(true);
    setScannerUnavailable(false);
    try {
      const res = await fetch("/api/scan-wifi");
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.success && Array.isArray(data.networks) && data.networks.length > 0) {
          setAvailableNetworks(data.networks);
          return;
        }
      }
      setScannerUnavailable(true);
      setAvailableNetworks([]);
    } catch {
      setScannerUnavailable(true);
      setAvailableNetworks([]);
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (church) {
      const savedSsid = church.beaconConfig?.ssidHint || "";
      const savedBssid = church.beaconConfig?.targetBssid || "";
      const isGeoSet = Boolean(
        church.geoFallback &&
        church.geoFallback.radiusMeters > 0 &&
        (church.geoFallback.latitude !== 0 || church.geoFallback.longitude !== 0)
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

      // Only evaluate default collapse state once on initial load
      if (!hasInitializedCollapse) {
        const isAlreadyCalibrated = Boolean(savedBssid && isGeoSet);
        setIsCollapsed(isAlreadyCalibrated);
        setHasInitializedCollapse(true);
      }
    }
    scanRealWifi();
  }, [church, hasInitializedCollapse]);

  // One-tap browser geolocation pickup
  const handleUseCurrentLocation = () => {
    setLocating(true);
    setLocatingError(null);

    if (!("geolocation" in navigator)) {
      setLocatingError("Geolocation API is not supported by your browser.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(parseFloat(position.coords.latitude.toFixed(6)));
        setLongitude(parseFloat(position.coords.longitude.toFixed(6)));
        setLocating(false);
      },
      (err) => {
        console.warn("Geolocation error:", err);
        const msg =
          err.code === 1
            ? "Location access denied. Please grant permission in browser settings."
            : "Unable to acquire GPS lock. You can drag the pin on the map directly.";
        setLocatingError(msg);
        toast.error(msg);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const handleSelectNetwork = (net: ScannedWifi) => {
    setSsidHint(net.ssid);
    setTargetBssid(net.bssid);
  };

  // Real-time regex validation for premises router and coordinates
  const ssidValidation = ssidHint ? validateSsid(ssidHint) : { isValid: true, error: null };
  const bssidValidation = targetBssid ? validateMacAddress(targetBssid) : { isValid: true, error: null };
  const coordsValidation = validateCoordinates(latitude, longitude);

  // Commit Anchor Calibration handler (Validates both anchors and collapses)
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    // Both Section A and Section B are strictly REQUIRED
    const ssidVal = validateSsid(ssidHint);
    if (!ssidVal.isValid) {
      toast.error(ssidVal.error);
      setSaving(false);
      return;
    }

    const bssidVal = validateMacAddress(targetBssid);
    if (!bssidVal.isValid) {
      toast.error(bssidVal.error);
      setSaving(false);
      return;
    }

    const coordsVal = validateCoordinates(latitude, longitude);
    if (!coordsVal.isValid) {
      toast.error(coordsVal.error);
      setSaving(false);
      return;
    }

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
        },
      });

      setSaveSuccess(true);
      setIsCollapsed(true); // Automatically collapse menu after committing
      toast.success(
        "Dual presence anchors successfully calibrated and committed!",
      );
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to update presence anchors.");
    } finally {
      setSaving(false);
    }
  };

  const handleEditClick = (section?: "A" | "B") => {
    setIsCollapsed(false);
    if (section === "A") {
      setSectionAOpen(true);
    } else if (section === "B") {
      setSectionBOpen(true);
    }
  };

  const handleCancelEdit = () => {
    if (church) {
      setSsidHint(church.beaconConfig?.ssidHint || "");
      setTargetBssid(church.beaconConfig?.targetBssid || "");
      setLatitude(church.geoFallback?.latitude ?? 4.975);
      setLongitude(church.geoFallback?.longitude ?? 8.3417);
      setRadiusMeters(church.geoFallback?.radiusMeters ?? 10);
    }
    setIsCollapsed(true);
  };

  const isWifiConfigured = Boolean(
    targetBssid && targetBssid.trim() !== "" &&
    ssidHint && ssidHint.trim() !== ""
  );

  const isGeoConfigured = Boolean(
    church?.geoFallback &&
    church.geoFallback.radiusMeters > 0 &&
    (church.geoFallback.latitude !== 0 || church.geoFallback.longitude !== 0)
  );

  const isFullyCalibrated = isWifiConfigured && isGeoConfigured;

  return (
    <div className={styles.pageContainer}>
      <div className={styles.headerSection}>
        <div>
          <h1 className={styles.headerTitle}>
            Premises Presence Anchors Calibration
          </h1>
          <p className={styles.headerSubtitle}>
            Configure physical on-premise verification boundaries. Both Section
            A (Wi-Fi) and Section B (Geofence) are required to ensure continuous
            attendance verification with automated 30–45s failover.
          </p>
        </div>
      </div>

      {/* Dual Redundancy Architecture Callout */}
      <div className={styles.systemArchitectureBanner}>
        <Radio size={24} color="#2563EB" style={{ flexShrink: 0 }} />
        <div className={styles.systemArchitectureText}>
          <strong>Dual-Anchor Redundancy (Required):</strong> All mobile
          attendance submissions first authenticate via the router BSSID in
          Section A. If the premises router is unpowered or unreachable within a{" "}
          <strong>30–45s timeout</strong>, the mobile app automatically
          transitions to verifying attendance against the{" "}
          <strong>Geofence Perimeter</strong> in Section B.
        </div>
      </div>

      {/* ====================================================================
          COLLAPSED CALIBRATED SUMMARY VIEW
          Renders when anchors are committed & active
          ==================================================================== */}
      {isCollapsed ? (
        <div className={styles.collapsedContainer}>
          <div className={styles.collapsedHeaderCard}>
            <div className={styles.collapsedHeaderLeft}>
              <div className={styles.calibratedShieldIcon}>
                <ShieldCheck size={26} />
              </div>
              <div className={styles.collapsedHeaderTexts}>
                <div className={styles.collapsedHeaderTitle}>
                  <span>
                    {isFullyCalibrated
                      ? "Premises Presence Anchors Active"
                      : "Premises Presence Anchors Setup Required"}
                  </span>
                  <span
                    className={
                      isFullyCalibrated
                        ? styles.activeStatusPill
                        : styles.warningStatusPill
                    }
                  >
                    <span
                      className={
                        isFullyCalibrated
                          ? styles.activeStatusDot
                          : styles.warningStatusDot
                      }
                    />
                    <span>
                      {isFullyCalibrated
                        ? "Calibrated & Active"
                        : "Pending Calibration"}
                    </span>
                  </span>
                </div>
                <span className={styles.collapsedHeaderSub}>
                  Dual-anchor verification operational. Devices authenticate via
                  router hardware or the calibrated 10m perimeter fail-safe.
                </span>
              </div>
            </div>

            <button
              type="button"
              className={styles.editMainBtn}
              onClick={() => handleEditClick()}
              title="Click to edit and recalibrate presence anchors"
            >
              <Edit3 size={16} />
              <span>Edit Anchor Calibration</span>
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
                    <h4>Section A — Network Anchor</h4>
                    <span>Primary Hardware Router Fence</span>
                  </div>
                </div>
                <button
                  type="button"
                  className={styles.editCardBtn}
                  onClick={() => handleEditClick("A")}
                  title="Edit network router anchor"
                >
                  <Edit3 size={13} />
                  <span>Edit Network</span>
                </button>
              </div>

              <div className={styles.summaryDataRows}>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Broadcasted SSID
                  </span>
                  <span className={styles.summaryDataValue}>
                    {ssidHint || "Not Configured"}
                  </span>
                </div>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Hardware MAC (BSSID)
                  </span>
                  <span className={styles.summaryDataValueMono}>
                    {targetBssid || "Pending Calibration"}
                  </span>
                </div>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Verification Policy
                  </span>
                  <span className={styles.summaryDataValue}>
                    Primary Gateway · 30-45s timeout
                  </span>
                </div>
                <div className={styles.summaryDataRow}>
                  <span className={styles.summaryDataLabel}>
                    Hardware Status
                  </span>
                  <span
                    style={{
                      color: isWifiConfigured ? "#059669" : "#D97706",
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {isWifiConfigured ? (
                      <>
                        <CheckCircle2 size={14} /> Active & Locked
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} /> Unconfigured · Pending Calibration
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
                  onClick={() => handleEditClick("B")}
                  title="Edit geofence location anchor"
                >
                  <Edit3 size={13} />
                  <span>Edit Location</span>
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
                      "Premises Coordinates"}
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
                      fontWeight: 600,
                      fontSize: "0.8rem",
                      display: "flex",
                      alignItems: "center",
                      gap: 5,
                    }}
                  >
                    {isGeoConfigured ? (
                      <>
                        <CheckCircle2 size={14} /> Active on 30-45s Timeout
                      </>
                    ) : (
                      <>
                        <AlertTriangle size={14} /> Unconfigured · Pending Calibration
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Collapsed mini map preview */}
              <div
                style={{
                  marginTop: "4px",
                  borderRadius: "8px",
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
                  height={180}
                  hideOverlay
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ====================================================================
           EXPANDED EDIT MODE
           Renders when editing or initially calibrating
           ==================================================================== */
        <form
          onSubmit={handleSave}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-xl)",
          }}
        >
          <div className={styles.anchorsGrid}>
            {/* Section A: Primary Wi-Fi Anchor */}
            <div className={styles.anchorCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleWrapper}>
                  <div className={`${styles.cardIcon} ${styles.iconWifi}`}>
                    <Wifi size={22} />
                  </div>
                  <div className={styles.cardTitles}>
                    <h3>Section A — Premises Wi-Fi Anchor</h3>
                    <p>Physical router hardware radio presence</p>
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    className={`${styles.priorityBadge} ${styles.badgeTier1}`}
                  >
                    Required Anchor
                  </span>
                  <button
                    type="button"
                    className={styles.accordionToggleBtn}
                    onClick={() => setSectionAOpen(!sectionAOpen)}
                    title={
                      sectionAOpen ? "Collapse Section A" : "Expand Section A"
                    }
                  >
                    {sectionAOpen ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>
              </div>

              {sectionAOpen && (
                <>
                  {/* Currently Configured Router Anchor Banner */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                      backgroundColor: "#F8FAFC",
                      border: "1.5px solid #CBD5E1",
                      borderRadius: "10px",
                      gap: "10px",
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                    >
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "8px",
                          backgroundColor: "#ECFDF5",
                          color: "#059669",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Wifi size={16} />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.725rem",
                            color: "#64748B",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Configured Premises Router
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            flexWrap: "wrap",
                          }}
                        >
                          <strong
                            style={{ fontSize: "0.875rem", color: "#0F172A" }}
                          >
                            {ssidHint || "None Configured Yet"}
                          </strong>
                          {targetBssid && (
                            <span
                              className="mono"
                              style={{
                                fontSize: "0.75rem",
                                backgroundColor: "#FFFFFF",
                                padding: "1px 6px",
                                borderRadius: "4px",
                                border: "1px solid #CBD5E1",
                                color: "#334155",
                              }}
                            >
                              {targetBssid}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {targetBssid ? (
                      <span
                        style={{
                          fontSize: "0.725rem",
                          fontWeight: 700,
                          color: "#059669",
                          backgroundColor: "#DCFCE7",
                          padding: "3px 10px",
                          borderRadius: "999px",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <CheckCircle2 size={13} /> Active Anchor
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.725rem",
                          fontWeight: 600,
                          color: "#D97706",
                          backgroundColor: "#FEF3C7",
                          padding: "3px 10px",
                          borderRadius: "999px",
                        }}
                      >
                        Click Network Below
                      </span>
                    )}
                  </div>

                  {/* Mobile App Calibration Helper Card */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      padding: "16px",
                      backgroundColor: "rgba(2, 132, 199, 0.05)",
                      border: "1.5px solid #BAE6FD",
                      borderRadius: "12px",
                      gap: "12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            backgroundColor: "#0284C7",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Radio size={20} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0F172A", margin: 0 }}>
                            Calibrate using Presenti Mobile App (Recommended)
                          </h4>
                          <span style={{ fontSize: "0.8rem", color: "#64748B" }}>
                            Smartphones have direct access to physical Wi-Fi hardware and GPS chips
                          </span>
                        </div>
                      </div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "4px 10px",
                          borderRadius: "999px",
                          backgroundColor: "#ECFDF5",
                          border: "1px solid #A7F3D0",
                          color: "#059669",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle2 size={13} /> Live Cloud Sync Active
                      </div>
                    </div>

                    <div style={{ fontSize: "0.825rem", color: "#334155", lineHeight: 1.5 }}>
                      1. Open the <strong>Presenti Mobile App</strong> on your smartphone while on premises.<br />
                      2. Sign in with your administrator account (or tap <em>Administrator? Calibrate Premises Anchors</em>).<br />
                      3. Tap your router from the physical Wi-Fi scan list, adjust the geofence map pin, and tap <strong>Save</strong>.<br />
                      👉 <em>This web page will automatically update in real-time as soon as you save on mobile!</em>
                    </div>

                    {church?.churchCode && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.825rem", color: "#475569" }}>
                        <span>Organization Code:</span>
                        <code style={{ backgroundColor: "#F1F5F9", padding: "2px 8px", borderRadius: "4px", fontWeight: 700, color: "#0284C7" }}>
                          {church.churchCode}
                        </code>
                      </div>
                    )}
                  </div>

                  {/* OS-Style Native Wi-Fi Drawer Widget */}
                  <div className={styles.osWifiDrawer}>
                    <div className={styles.osWifiTopRow}>
                      <div className={styles.osWifiCircleIcon}>
                        <Wifi size={20} />
                      </div>
                      <div className={styles.osWifiTitleGroup}>
                        <span className={styles.osWifiTitle}>
                          Scan Nearby Wi-Fi
                        </span>
                        <button
                          type="button"
                          onClick={scanRealWifi}
                          disabled={isScanning}
                          className={styles.osWifiRefreshBtn}
                          title="Rescan physical wireless networks"
                        >
                          <RefreshCw
                            size={15}
                            className={isScanning ? "spinner" : ""}
                          />
                        </button>
                      </div>
                    </div>

                    <div className={styles.osWifiList}>
                      {isScanning ? (
                        <div
                          style={{
                            padding: "16px",
                            textAlign: "center",
                            color: "#94A3B8",
                            fontSize: "0.85rem",
                          }}
                        >
                          Scanning wireless hardware in vicinity...
                        </div>
                      ) : availableNetworks.length > 0 ? (
                        availableNetworks.map((net) => {
                          const isSelected =
                            Boolean(targetBssid) &&
                            targetBssid.toLowerCase() ===
                              net.bssid.toLowerCase();
                          return (
                            <div
                              key={net.bssid || net.ssid}
                              className={`${styles.osWifiItem} ${isSelected ? styles.osWifiItemActive : ""}`}
                              onClick={() => handleSelectNetwork(net)}
                              title={`Click to select ${net.ssid} (${net.bssid})`}
                            >
                              <div className={styles.osWifiItemLeft}>
                                <Wifi
                                  size={16}
                                  color={isSelected ? "#38BDF8" : "#CBD5E1"}
                                />
                                <Lock size={12} color="#94A3B8" />
                                <span className={styles.osWifiItemName}>
                                  {net.ssid}
                                </span>
                              </div>
                              <div className={styles.osWifiItemMeta}>
                                <span>{net.band}</span>
                                {isSelected && (
                                  <Check size={16} color="#38BDF8" />
                                )}
                              </div>
                            </div>
                          );
                        })
                      ) : scannerUnavailable ? (
                        <div
                          style={{
                            padding: "12px 14px",
                            backgroundColor: "rgba(15, 23, 42, 0.6)",
                            borderRadius: "8px",
                            border: "1px dashed rgba(56, 189, 248, 0.25)",
                            margin: "4px 0",
                            fontSize: "0.82rem",
                            lineHeight: "1.5",
                            color: "#94A3B8",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              color: "#38BDF8",
                              fontWeight: 600,
                              marginBottom: "4px",
                            }}
                          >
                            <Info size={14} />
                            <span>Live Cloud Environment Detected</span>
                          </div>
                          <p style={{ margin: "0 0 6px 0", fontSize: "0.8rem" }}>
                            Web browsers prevent cloud-hosted websites (like Vercel) from directly scanning nearby Wi-Fi radio hardware for privacy and security.
                          </p>
                          <p style={{ margin: 0, color: "#CBD5E1", fontSize: "0.8rem" }}>
                            👉 Please enter your router&apos;s <strong>SSID</strong> and <strong>MAC (BSSID)</strong> directly in the fields below.
                          </p>
                        </div>
                      ) : (
                        <div
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "#94A3B8",
                            fontSize: "0.825rem",
                          }}
                        >
                          No networks detected. Click refresh icon to scan again.
                        </div>
                      )}
                    </div>

                    <div
                      className={styles.osWifiAllNetworks}
                      onClick={() => setShowManualWifi(!showManualWifi)}
                    >
                      {showManualWifi
                        ? "Hide MAC address tips"
                        : "Need help finding your Router's MAC (BSSID)?"}
                    </div>

                    {showManualWifi && (
                      <div
                        style={{
                          marginTop: "8px",
                          padding: "12px",
                          backgroundColor: "rgba(15, 23, 42, 0.5)",
                          borderRadius: "6px",
                          fontSize: "0.8rem",
                          color: "#CBD5E1",
                          lineHeight: "1.6",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                        }}
                      >
                        <div style={{ fontWeight: 600, color: "#F8FAFC", marginBottom: "4px" }}>
                          Ways to find your router MAC (BSSID):
                        </div>
                        <ul style={{ paddingLeft: "18px", margin: 0 }}>
                          <li><strong>Physical Router Sticker:</strong> Look for <em>MAC</em> or <em>BSSID</em> on the label under/behind your router.</li>
                          <li><strong>Windows PC:</strong> Open CMD and run <code style={{ backgroundColor: "#1E293B", padding: "1px 4px", borderRadius: "3px" }}>netsh wlan show networks mode=bssid</code></li>
                          <li><strong>Mac:</strong> Hold <code style={{ backgroundColor: "#1E293B", padding: "1px 4px", borderRadius: "3px" }}>Option (⌥)</code> and click the Wi-Fi icon in the top menu bar.</li>
                          <li><strong>Linux:</strong> Run <code style={{ backgroundColor: "#1E293B", padding: "1px 4px", borderRadius: "3px" }}>nmcli dev wifi list</code></li>
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Configured Wi-Fi Summary Inputs */}
                  <div className={styles.fieldGroup}>
                    <label htmlFor="ssidHint">
                      Selected Premises Router SSID Label *
                    </label>
                    <input
                      id="ssidHint"
                      type="text"
                      value={ssidHint}
                      onChange={(e) => setSsidHint(e.target.value)}
                      placeholder="e.g. Church_Guest_5G or Sanctuary_Office"
                      className={!ssidValidation.isValid ? styles.inputError : ""}
                      required
                    />
                    {!ssidValidation.isValid ? (
                      <span className={styles.fieldErrorText}>
                        <AlertCircle size={12} /> {ssidValidation.error}
                      </span>
                    ) : (
                      <span className={styles.fieldHelp}>
                        Display name broadcasted by your premises router.
                      </span>
                    )}
                  </div>

                  <div className={styles.fieldGroup}>
                    <label htmlFor="targetBssid">
                      Hardware BSSID (MAC Address) *
                    </label>
                    <input
                      id="targetBssid"
                      type="text"
                      className={`mono ${!bssidValidation.isValid ? styles.inputError : ""}`}
                      value={targetBssid}
                      onChange={(e) => setTargetBssid(e.target.value)}
                      placeholder="0c:61:f9:65:8f:07"
                      required
                    />
                    {!bssidValidation.isValid ? (
                      <span className={styles.fieldErrorText}>
                        <AlertCircle size={12} /> {bssidValidation.error}
                      </span>
                    ) : (
                      <span className={styles.fieldHelp}>
                        The unique physical hardware MAC address used for
                        tamper-proof mobile validation.
                      </span>
                    )}
                  </div>

                  <div
                    className="badge badge-success"
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      marginTop: "auto",
                    }}
                  >
                    <CheckCircle2 size={15} />
                    <span>
                      Hardware spoofing protected: Mobile apps query native
                      Wi-Fi scan registers directly.
                    </span>
                  </div>
                </>
              )}
            </div>

            {/* Section B: Geofence & Location Anchor */}
            <div className={styles.anchorCard}>
              <div className={styles.cardHeader}>
                <div className={styles.cardTitleWrapper}>
                  <div className={`${styles.cardIcon} ${styles.iconGeo}`}>
                    <MapPin size={22} />
                  </div>
                  <div className={styles.cardTitles}>
                    <h3>Section B — Geofence & Location Anchor</h3>
                    <p>
                      Pinpoint premises coordinates and calibrated 10m boundary
                    </p>
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    className={`${styles.priorityBadge} ${styles.badgeTier2}`}
                  >
                    Required Anchor
                  </span>
                  <button
                    type="button"
                    className={styles.accordionToggleBtn}
                    onClick={() => setSectionBOpen(!sectionBOpen)}
                    title={
                      sectionBOpen ? "Collapse Section B" : "Expand Section B"
                    }
                  >
                    {sectionBOpen ? (
                      <ChevronUp size={18} />
                    ) : (
                      <ChevronDown size={18} />
                    )}
                  </button>
                </div>
              </div>

              {sectionBOpen && (
                <>
                  {/* Location Pinpoint Search Bar with Method 1 (GPS) & Method 2 (Google Maps) */}
                  <LocationSearchPinpoint
                    currentLat={latitude}
                    currentLng={longitude}
                    onCoordinatesChange={(lat, lng, label) => {
                      setLatitude(lat);
                      setLongitude(lng);
                      if (label) {
                        setPinnedLocationName(label);
                      }
                    }}
                    locationLabel={
                      pinnedLocationName ||
                      church?.branchName ||
                      church?.churchName
                    }
                    onUseCurrentLocation={handleUseCurrentLocation}
                    isLocating={locating}
                  />

                  {locatingError && (
                    <div
                      className="badge badge-danger"
                      style={{ padding: "8px 12px", borderRadius: "6px" }}
                    >
                      <AlertTriangle size={15} />
                      <span>{locatingError}</span>
                    </div>
                  )}

                  {/* Interactive Presence Map with Google Satellite & Deep Zoom */}
                  <GooglePresenceMap
                    latitude={latitude}
                    longitude={longitude}
                    radiusMeters={radiusMeters}
                    onCoordinatesChange={(lat, lng) => {
                      setLatitude(lat);
                      setLongitude(lng);
                    }}
                    locationLabel={
                      pinnedLocationName ||
                      church?.branchName ||
                      church?.churchName ||
                      "Premises Coordinates Center"
                    }
                    height={340}
                  />

                  <div className={styles.coordInputs}>
                    <div className={styles.fieldGroup}>
                      <label htmlFor="latitude">Venue Latitude *</label>
                      <input
                        id="latitude"
                        type="number"
                        step="0.000001"
                        value={latitude}
                        onChange={(e) =>
                          setLatitude(parseFloat(e.target.value))
                        }
                        className={!coordsValidation.isValid ? styles.inputError : ""}
                        placeholder="4.975000"
                        required
                      />
                    </div>

                    <div className={styles.fieldGroup}>
                      <label htmlFor="longitude">Venue Longitude *</label>
                      <input
                        id="longitude"
                        type="number"
                        step="0.000001"
                        value={longitude}
                        onChange={(e) =>
                          setLongitude(parseFloat(e.target.value))
                        }
                        className={!coordsValidation.isValid ? styles.inputError : ""}
                        placeholder="8.341700"
                        required
                      />
                    </div>
                  </div>
                  {!coordsValidation.isValid && (
                    <div className={styles.fieldErrorText} style={{ marginTop: 4 }}>
                      <AlertCircle size={12} /> {coordsValidation.error}
                    </div>
                  )}

                  {/* Circumference Controls (10m default + Presets + Slider) */}
                  <div className={styles.fieldGroup}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 2,
                      }}
                    >
                      <label>Allowed Geofence Circumference *</label>
                      <span className={styles.radiusDisplayBadge}>
                        {radiusMeters}m radius (Diameter: {radiusMeters * 2}m)
                      </span>
                    </div>
                    <div className={styles.radiusGrid}>
                      {RADIUS_OPTIONS.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setRadiusMeters(r)}
                          className={`${styles.radiusBtn} ${radiusMeters === r ? styles.radiusBtnActive : ""}`}
                        >
                          {r}m
                        </button>
                      ))}
                    </div>

                    <div className={styles.radiusSliderRow}>
                      <input
                        type="range"
                        min="5"
                        max="150"
                        step="1"
                        value={radiusMeters}
                        onChange={(e) =>
                          setRadiusMeters(parseInt(e.target.value, 10))
                        }
                        className={styles.radiusSlider}
                      />
                      <span
                        style={{
                          fontSize: "0.8rem",
                          color: "#64748B",
                          minWidth: 50,
                        }}
                      >
                        {radiusMeters}m
                      </span>
                    </div>
                    <span className={styles.fieldHelp}>
                      Maximum distance from premises center for coordinate-based
                      clock-in. Default: 10 meters.
                    </span>
                  </div>

                  <div className={styles.fallbackPromptCard}>
                    <Info
                      size={18}
                      color="#D97706"
                      style={{ flexShrink: 0, marginTop: 2 }}
                    />
                    <div className={styles.fallbackPromptText}>
                      <strong>Automated Fail-Safe Rule:</strong> If the premises
                      router is offline, the mobile app waits 30–45 seconds then
                      automatically verifies members against this calibrated 10m
                      geofence.
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom Actions Bar (when editing) */}
          <div className={styles.actionsBar}>
            {saveSuccess && (
              <span className={styles.saveSuccess}>
                <CheckCircle2 size={16} />
                <span>Dual anchors successfully synchronized.</span>
              </span>
            )}
            <button
              type="button"
              className={styles.cancelEditBtn}
              onClick={handleCancelEdit}
              title="Cancel editing and collapse menu"
            >
              <X size={16} />
              <span>Cancel / Collapse</span>
            </button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              <Save size={16} />
              <span>
                {saving
                  ? "Synchronizing Anchors..."
                  : "Commit Anchor Calibration"}
              </span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
