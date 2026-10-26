import React from "react";
import { NavLink, Outlet, useNavigate, Navigate } from "react-router-dom";
import {
  Activity,
  Radio,
  Users,
  Sliders,
  FileSpreadsheet,
  LogOut,
  Wifi,
  MapPin,
  CheckCircle,
  Copy,
  Menu,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import styles from "./AppLayout.module.css";

export const AppLayout: React.FC = () => {
  const { user, church, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = React.useState(false);

  // Close mobile drawer on route change
  React.useEffect(() => {
    setIsMobileDrawerOpen(false);
  }, [navigate]);

  if (!loading && user && !church) {
    return <Navigate to="/onboarding" replace />;
  }

  const handleLogout = async () => {
    await logout();
    toast.info("Signed out successfully.");
    navigate("/login");
  };

  const copyChurchCode = () => {
    if (church?.churchCode) {
      navigator.clipboard.writeText(church.churchCode);
      toast.success(
        `Copied Organization Code "${church.churchCode}" to clipboard!`,
      );
    }
  };

  const isGeofenceOnly =
    church?.beaconConfig?.verificationMode === "GEOFENCE_ONLY";

  const isWifiConfigured = Boolean(
    church?.beaconConfig?.ssidHint &&
    church.beaconConfig.ssidHint.trim() !== "" &&
    church?.beaconConfig?.targetBssid &&
    church.beaconConfig.targetBssid.trim() !== "",
  );

  const isGeoConfigured = Boolean(
    (church?.isCalibrated ||
      church?.geoFallback?.isCalibrated ||
      church?.geoFallback?.isConfigured) &&
    church?.geoFallback &&
    church.geoFallback.radiusMeters > 0 &&
    (church.geoFallback.latitude !== 0 || church.geoFallback.longitude !== 0),
  );

  const isFullyConfigured = isGeofenceOnly
    ? isGeoConfigured
    : isWifiConfigured && isGeoConfigured;

  return (
    <div className={styles.layoutRoot}>
      {/* Mobile Drawer Backdrop */}
      {isMobileDrawerOpen && (
        <div
          className={styles.drawerBackdrop}
          onClick={() => setIsMobileDrawerOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      {/* Sidebar Navigation (Desktop Static / Mobile Slide-Out Drawer) */}
      <aside
        className={`${styles.sidebar} ${
          isMobileDrawerOpen ? styles.sidebarOpen : ""
        } no-print`}
      >
        <div className={styles.brandHeader}>
          <img
            src="/image/app-icon.png"
            alt="Presenti"
            className={styles.brandLogoImg}
          />
          <span className={styles.brandTitle}>Presenti</span>
          <button
            type="button"
            className={styles.sidebarCloseBtn}
            onClick={() => setIsMobileDrawerOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {church && (
          <div className={styles.churchMetaCard}>
            <div className={styles.churchMetaLabel}>Organization Workspace</div>
            <div className={styles.churchMetaName} title={church.churchName}>
              {church.churchName}
            </div>
            <button
              type="button"
              onClick={copyChurchCode}
              className={styles.churchMetaCodeBtn}
              title="Click to copy Organization Code for mobile pairing"
            >
              <span>{church.churchCode}</span>
              <Copy size={11} />
            </button>
          </div>
        )}

        <nav className={styles.navigation}>
          <NavLink
            to="/dashboard"
            onClick={() => setIsMobileDrawerOpen(false)}
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Activity size={18} />
            <span>Live Attendance Feed</span>
          </NavLink>

          <NavLink
            to="/settings/beacon"
            onClick={() => setIsMobileDrawerOpen(false)}
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Radio size={18} />
            <span>Presence Anchors</span>
            {!isFullyConfigured && (
              <span
                className="badge badge-warning"
                style={{
                  fontSize: "0.62rem",
                  marginLeft: "auto",
                  padding: "2px 6px",
                }}
              >
                Setup
              </span>
            )}
          </NavLink>

          <NavLink
            to="/members"
            onClick={() => setIsMobileDrawerOpen(false)}
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Users size={18} />
            <span>Organization Registered Users</span>
          </NavLink>

          <NavLink
            to="/setup"
            onClick={() => setIsMobileDrawerOpen(false)}
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <Sliders size={18} />
            <span>Organization & Policy</span>
          </NavLink>

          <NavLink
            to="/reports"
            onClick={() => setIsMobileDrawerOpen(false)}
            className={({ isActive }) =>
              isActive
                ? `${styles.navLink} ${styles.navLinkActive}`
                : styles.navLink
            }
          >
            <FileSpreadsheet size={18} />
            <span>Monthly Audit Matrix</span>
          </NavLink>
        </nav>

        {/* Sidebar Footer with Google Profile */}
        <div className={styles.sidebarFooter}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              overflow: "hidden",
            }}
          >
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt="Avatar"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  backgroundColor: "#2563EB",
                  color: "#FFFFFF",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {user?.displayName?.[0] || "A"}
              </div>
            )}
            <div className={styles.adminInfo}>
              <span
                className={styles.adminEmail}
                title={user?.displayName || user?.email || "Admin"}
              >
                {user?.displayName || user?.email}
              </span>
              <span
                className={styles.adminRole}
                style={{ display: "flex", alignItems: "center", gap: 4 }}
              >
                <CheckCircle size={10} color="#10B981" /> Verified Administrator
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className={styles.logoutBtn}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className={styles.mainWrapper}>
        <header className={`${styles.topbar} no-print`}>
          <div className={styles.topbarLeft}>
            <button
              type="button"
              className={styles.hamburgerBtn}
              onClick={() => setIsMobileDrawerOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={20} />
            </button>
            <div className={styles.topbarTitle}>
              {church?.branchName ||
                church?.churchName ||
                "Attendance Command Center"}
            </div>
          </div>

          <div className={styles.topbarRight}>
            {church?.churchCode && (
              <button
                type="button"
                onClick={copyChurchCode}
                className={styles.topbarCodePill}
                title="Click to copy Organization Code for mobile pairing"
              >
                <span className={styles.topbarCodeLabel}>Org Code:</span>
                <code>{church.churchCode}</code>
                <Copy size={12} />
              </button>
            )}

            {isGeofenceOnly ? (
              <div className={styles.hardwareAnchorStatus}>
                <Radio
                  size={14}
                  color={isGeoConfigured ? "#059669" : "#D97706"}
                />
                <span>
                  Mode:{" "}
                  <strong>
                    {isGeoConfigured
                      ? "Router-Free (GPS Active)"
                      : "GPS Only · Pending"}
                  </strong>
                </span>
              </div>
            ) : (
              <div className={styles.hardwareAnchorStatus}>
                <Wifi
                  size={14}
                  color={isWifiConfigured ? "#059669" : "#D97706"}
                />
                <span>
                  Wi-Fi:{" "}
                  <strong>
                    {isWifiConfigured
                      ? church?.beaconConfig?.targetBssid
                      : "Unconfigured"}
                  </strong>
                </span>
              </div>
            )}

            <div className={styles.hardwareAnchorStatus}>
              <MapPin
                size={14}
                color={isGeoConfigured ? "#2563EB" : "#D97706"}
              />
              <span>
                Geofence:{" "}
                <strong>
                  {isGeoConfigured
                    ? `${church?.geoFallback?.radiusMeters}m`
                    : "Unconfigured"}
                </strong>
              </span>
            </div>
          </div>
        </header>

        <main className={styles.contentArea}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};
